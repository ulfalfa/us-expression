/* eslint no-unused-vars: 0 */
'use strict';

const assert = require('assert');
const debug = require('debug')('us.expression');
const objectPath = require("object-path");


function isPromise(value) {
  return (typeof value.then === 'function');
}

function isFunction(value) {
  return (typeof value === 'function');
}
function isArray(value) {
  return Array.isArray(value);
}

function isObject(value) {
  return (typeof value ==='object');
}

function isUndefined(value) {
  return (typeof value ==='undefined');
}


function isSimpleType(expr) {
  let type = typeof expr;
  return (
    type==='string' ||
    type==='number' ||
    type==='boolean'
  );
}


const MATCH_NAME = /([^\[]*)/;
const MATCH_BRACKETS = /\[([^\]]+)]/;


const SIMPLE_FUNCS = {
  "$eq": (value, params) => (value === params),
  "$neq": (value, params) => (value !== params),
  "$gt": (value, params) => (value > params),
  "$gte": (value, params) => (value >= params),
  "$lt": (value, params) => (value < params),
  "$lte": (value, params) => (value <= params),
  "$in": (value, params) => (params.indexOf(value)>-1),
  "$nin": (value, params) => (params.indexOf(value)==-1)
}


class UsExpression {

  constructor(resolveFunc,caching=true) {

    assert(isFunction(resolveFunc),new Error('resolve function missing'));


    this.LOGICAL_FUNCS = {
      "$and": (exprArr) => {
        assert(isArray(exprArr),'expression for $and must be an array');

        let queries = exprArr.map((expr) => (this.compile(expr)));

        return () => {
          return queries.reduce((previous, current, index) => {
            return previous
              .then((curResult) => {
                if (curResult) {
                  return current();
                }
                else {
                  return false;
                }
              })
          },(Promise.resolve(true)));

        };
      },
      "$or": (exprArr) => {
        assert(isArray(exprArr),'expression for $or must be an array');

        let queries = exprArr.map((expr) => (this.compile(expr)));

        return () => {
          return queries.reduce((previous, current, index) => {
            return previous
              .then((curResult) => {
                if (!curResult) {
                  return current();
                }
                else {
                  return true;
                }
              })
          },(Promise.resolve(false)));

        };
      },
      "$not": (expr) => {
        //assert(!isObject(expr),'expression for $not must be an object');

        let compiled = this.compile(expr);

        return () => {
          return compiled()
            .then((result) => {
              return !result;
            })

        };
      }
    };

    this._funcs={};
    for (let func in SIMPLE_FUNCS) {
      if (SIMPLE_FUNCS.hasOwnProperty(func)) {
        this.registerFunction(func, SIMPLE_FUNCS[func]);

      }
    }


    this._valueCache={};
    this._fields = [];
    this.$$resolve$$ = resolveFunc;

    this._resolve = (value) => {
      return caching ? this._cachedResolve(value) : resolveFunc(value);
    };

  }

  registerFunction(op, func) {
    this._funcs[op] =  (field,expr) => ((() => {
      return this._parseValue(expr)
          .then((val2) => {
            return this._parseValue(field)
              .then((val1) => func(val1,val2));
          });
    }));
  }

  _cachedResolve(fieldAccessor) {
    let value = fieldAccessor.match(MATCH_NAME).shift();
    let accessor = fieldAccessor.match(MATCH_BRACKETS);


    let cachedValue = this._valueCache[value];
    let retPromise;
    if (!isUndefined(cachedValue)) {
      debug('Using cache %s', value)
      retPromise= Promise.resolve(cachedValue);
    }
    else {
      retPromise = this.$$resolve$$(value)
      .then((resolveValue) => {
        debug('Resolving %s',value);
        this._valueCache[value]=resolveValue;
        return resolveValue;
      });
    }
    return retPromise
      .then((value) => {
        if (accessor) {
          debug ('Access value %j with path %s',value, accessor[1]);
          return objectPath.get(value,accessor[1]);

        }
        else {
          return value;
        }

      });
  }


  resetCache() {
    this._valueCache={};
  }


  _parseArray(valueArr) {
    return Promise.resolve()
      .then(() => {
        assert(isArray(valueArr),new Error('must be an array'));
        return Promise.all(valueArr.map((value) => (this._parseValue(value))));

      });
  }

  get fields() {
    return this._fields;
  }

  _addField(field) {
    try {
      JSON.parse(field);
    }
    catch (e) {
      let value = field.match(MATCH_NAME).shift();
      if (this._fields.indexOf(value)==-1) {
        debug ('Adding field', value, this._fields.length);
        this._fields.push(value);
      }
    }
  }

  _parseValue(value) {
    let retVal;

    if (isArray(value)) {
      return this._parseArray(value);
    }

    if (isObject(value)) {
      return Promise.resolve(value);
    }


    try {
      let parseResult =Promise.resolve(JSON.parse(value));
      retVal = parseResult;
    }
    catch (e) {
      retVal = this._resolve(value);
    }
    debug ('Value parsed %j->',value,retVal);
    return retVal;

  }
  _compileLogicalOperator(op, expr) {
    debug ('Compiling %s(%j)',op,expr);
    return this.LOGICAL_FUNCS[op](expr);
  }

  _compileSimpleOperator(field, op, expr) {

    debug ('Compiling %s(%s,%s)',op,field,expr);

    let retFunc = this._funcs[op];
    assert(!isUndefined(retFunc),
      new Error(`operator ${op} not supported`));
    return retFunc(field,expr);

  }

  _normalize(expr) {
    if (isSimpleType(expr)) {
      return {'$eq': expr}
    }

    return expr;
  }

  compile(query) {
    let compiled =[];
    assert (isObject(query),new Error('query must be an object'));
    assert (!isArray(query),new Error('query must not be an array'));
    let expr;
    for (let field in query) {
      if (query.hasOwnProperty(field)) {
        expr = query[field]
        if (this.LOGICAL_FUNCS.hasOwnProperty(field)) {
          compiled.push(this._compileLogicalOperator(field,expr));
        }
        else {
         // normalize expression
          expr = this._normalize(expr);

          for (let op in expr) {
            if (expr.hasOwnProperty(op)) {
              this._addField(field);
              compiled.push(
                this._compileSimpleOperator(field, op, expr[op])
              );
            }
          }
        }
      }
    }

    let compiledFunction = (options={}) => {
      return compiled.reduce((previous, current, index) => {
        return previous                                    // initiates the promise chain
          .then((curResult) => {
            if (curResult) {
              return current();
            }
            else {
              return false;
            }
          })
      }, Promise.resolve(true))
      .then((result) => {
        if (options.resetCache) {
          this.resetCache();
        }
        return result;
      });

    };

    compiledFunction.fields = this.fields;


    return compiledFunction;


  }


}

module.exports = exports = UsExpression;

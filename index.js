/* eslint no-unused-vars: 0 */
'use strict';

const assert = require('assert');
const debug = require('debug')('us.expression');


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


const LOGICAL_FUNCS = {
  "$and": (exprArr,parentUsExpr) => {
    assert(isArray(exprArr),'expression for $and must be an array');

    let queries = exprArr.map((expr) => (new UsExpression(expr, parentUsExpr._resolve,false)));

    return () => {
      return queries.reduce((previous, current, index) => {
        return previous
          .then((curResult) => {
            if (curResult) {
              return current.test();
            }
            else {
              return false;
            }
          })
      },(Promise.resolve(true)));

    };
  },
  "$or": (exprArr,parentUsExpr) => {
    assert(isArray(exprArr),'expression for $or must be an array');

    let queries = exprArr.map((expr) => (new UsExpression(expr, parentUsExpr._resolve,false)));

    return () => {
      return queries.reduce((previous, current, index) => {
        return previous
          .then((curResult) => {
            if (!curResult) {
              return current.test();
            }
            else {
              return true;
            }
          })
      },(Promise.resolve(false)));

    };
  },
  "$not": (expr,parentUsExpr) => {
    //assert(!isObject(expr),'expression for $not must be an object');

    let usExp = new UsExpression(expr, parentUsExpr._resolve,false);

    return () => {
      return usExp.test()
        .then((result) => {
          return !result;
        })

    };
  }
};

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

  constructor(query={}, resolveFunc,caching=true) {

    assert(isFunction(resolveFunc),new Error('resolve function missing'));
    this._valueCache={};
    this.$$resolve$$ = resolveFunc;

    this._resolve = (value) => {
      return caching ? this._cachedResolve(value) : resolveFunc(value);
    };

    this._test = this.compile(query);
  }

  _cachedResolve(value) {
    let cachedValue = this._valueCache[value];
    if (!isUndefined(cachedValue)) {
      debug('Using cache %s', value)
      return Promise.resolve(cachedValue);
    }
    return this.$$resolve$$(value)
      .then((resolveValue) => {
        debug('Resolving %s',value);
        this._valueCache[value]=resolveValue;
        return resolveValue;
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


  _parseFunction(functionName) {
    let retFunc = SIMPLE_FUNCS[functionName];
    assert(!isUndefined(retFunc),
      new Error(`operator ${functionName} not supported`));
    return retFunc;
  }

  _parseValue(value) {
    let retVal;

    if (isArray(value)) {
      return this._parseArray(value);
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

    return LOGICAL_FUNCS[op](expr,this);


  }

  _compileSimpleOperator(field, op, expr) {

    debug ('Compiling %s(%s,%s)',op,field,expr);

    let func = this._parseFunction(op);

    return (() => {
      return this._parseValue(expr)
      .then((val2) => {
        return this._parseValue(field)
          .then((val1) => func(val1,val2));
      });
    });

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
        if (LOGICAL_FUNCS.hasOwnProperty(field)) {
          compiled.push(this._compileLogicalOperator(field,expr));
        }
        else {
         // normalize expression
          expr = this._normalize(expr);

          for (let op in expr) {
            if (expr.hasOwnProperty(op)) {
              compiled.push(
                this._compileSimpleOperator(field, op, expr[op])
              );
            }
          }
        }
      }
    }

    return () => {
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
      }, Promise.resolve(true));

    };

  }

  get test() {
    if (isUndefined(this._test)) {
      this._test = this.compile();
    }
    return this._test;
  }


}

module.exports = exports = UsExpression;

/* eslint no-unused-vars: 0 */
'use strict';

const assert = require('assert');
const debug = require('debug')('us.expression');

function reduceExpressions(params,value=null, reduceFunc, startVal) {
  debug('REDUCING',params);
  let promises = params.map ((funcOrPromise) => {
    return funcOrPromise(value);
  });
  debug('promises', promises);
  return Promise.all(promises)
  .then((retValues) => {
    debug ('Now combining', retValues);
    return retValues.reduce(reduceFunc, startVal);
  });
}


const DEFAULT_FUNCS = {
  "$test": (value,params) => {
    debug ('Testing function', value,params);
    return true;
  },
  "$eq": (value, params) => (value === params),
  "$neq": (value, params) => (value !== params),
  "$gt": (value, params) => (value > params),
  "$gte": (value, params) => (value >= params),
  "$lt": (value, params) => (value < params),
  "$lte": (value, params) => (value <= params),
  "$in": (value, params) => (params.indexOf(value)>-1),
  "$nin": (value, params) => (params.indexOf(value)==-1),
  "$not": (value,params) => !params,
  "$and": (value,expressions) => {
    debug ('executing $and', value,expressions);
    return expressions.reduce((previous, current, index) => {
      return previous                                    // initiates the promise chain
        .then((curResult) => {
          if (curResult) {
            debug ('Still true - going on')
            return current(value);
          }
          else {
            return false;
          }
        })
    }, Promise.resolve(true));

  },
  "$or": (value,expressions) => {
    debug ('executing $or', value,expressions);
    return expressions.reduce((previous, current, index) => {
      return previous                                    // initiates the promise chain
        .then((curResult) => {
          if (curResult) {
            debug('ITS TRUE');
            return true;
          }
          else {
            debug ('Still false - going on')
            return current(value);
          }
        })
    }, Promise.resolve(false));
  }
}

function isPromise(value) {
  return (typeof value.then === 'function');
}


function isArray(value) {
  return Array.isArray(value);
}


class UsExpression {

  constructor(resolve) {
    this._resolve = resolve;
    this._funcs=DEFAULT_FUNCS;

  }

  registerFunc(name,func) {
    this._funcs[name]=func;

  }


  isFunction(value) {
    debug ('isFunction name', value.name)
    return (this._funcs.hasOwnProperty(value.name));
  }


  _compileArray(expressionArray) {
    assert(isArray(expressionArray), new Error('must be an array'));
    return expressionArray.map((expression) => this._compile(expression));
  }

  _compileObject(funcObject) {
    assert(typeof funcObject ==='object', new Error('must be an object'));
    let keys = Object.keys(funcObject);
    assert(keys.length === 1, new Error('can only have one property'));

    let func = this._parseFunction(keys[0]);
    let parameter = funcObject[keys[0]];

    if (func.name === "$and" || func.name === "$or") {
      let arrayOfFunctions = this._compileArray(parameter);

      return ((value) => {
        return this._parseValue(value)
          .then((value) => (func(value,arrayOfFunctions)));
      });

    }
    else {
      return ((value) => {
        return this._parse(parameter)
        .then((paramValue) => {
          return this._parse(value)
            .then((value) => func(value, paramValue));
        });
      });

    }


  }


  _compileValueExpression(expression) {
    return ((value) => {
      return this._parseValue(expression)
        .then((expressionValue) => {
          debug('Value', value);
          return this._parseValue(value)
            .then((value) => (value===expressionValue));

        })
    });
  }

  _compile(expression) {
    if (isArray(expression)) {
      return this._compileArray(expression)
    }
    else if (typeof expression === 'object') {
      return this._compileObject(expression);
    }
    else {
      return this._compileValueExpression(expression);
    }

  }

  _parseArray(valueArr) {

    return Promise.resolve()
      .then(() => {
        assert(isArray(valueArr),new Error('must be an array'));
        return Promise.all(valueArr.map((value) => (this._parse(value))));

      });


  }

  _parseObject(valueObject) {
    return valueObject;
  }

  _parseFunction(functionName) {
    return this._funcs[functionName];
  }

  _parseStaticValue(value) {
    let retVal;

    try {
      let parseResult =JSON.parse(value);
      retVal = parseResult;
    }
    catch (e) {
      retVal = value;
    }
    return retVal;

  }

  _parseValue(value) {
    let retVal;

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

  _parse(value) {
    if (isArray(value)) {
      return this._parseArray(value);
    }
    else if (typeof value === 'object') {
      return this._parseObject(value);
    }
    else {
      let retVal = this._parseFunction(value);
      if (typeof retVal === 'undefined') {
        retVal = this._parseValue(value)
      }
      return retVal;
    }
  }


}

module.exports = exports = UsExpression;

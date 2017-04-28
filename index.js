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

function identityFunc(value2Promise) {
  return function $id$(value1Promise)  {

    //value1Promise = Promise.resolve(value1Promise);


    return value1Promise().then((value1) => {
      return value2Promise().then((value2) => {
        if (typeof value1 !=='undefined') {
          return (value1===value2)
        }
        else {
          return value2;
        }
      });
    });
  }
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
  "$and": (value,params) => {
    debug ('executing $and', value,params);
    return reduceExpressions(params,value,(lhs,rhs) => (lhs&&rhs),true)
  },
  "$or": (value,params) => {
    debug ('executing $or', value,params);
    return reduceExpressions(params,value,(lhs,rhs) => (lhs||rhs),false)
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

  _parseArray(aArray) {
    return () => Promise.resolve(aArray.map((val) => this.parse(val)));
  }

  _parseObject(obj) {
    let keys = Object.keys(obj);

    if (keys.length === 1) {
      let lhs = this.parse(keys[0]);
      let rhs = this.parse(obj[keys[0]]);

      if (this.isFunction(lhs)) {
        debug ('LHS is a function %s', lhs.name);
        return (value) => {
          return rhs().then((params) => {
            debug ('Result from function RHS %s', rhs.name, params);

            debug('Calling lhs %s', lhs.name);


            let test = lhs(value, params);
            debug('Result ',test);
            return test;
          });
        }
      }
      else {
        debug ('LHS is a value / $id$ function', lhs);
        return ((value) => (lhs(rhs)));
      }


      /*
      if (this.isFunction(rhs)) {
        throw ('Function on righthand side not allowed');
      }
      if (!this.isFunction(lhs)) {
        //return equality function
        debug('equality lhs',lhs.name);
        debug('equality rhs',rhs.name);
        return () => {
          return rhs().then((params) => {
            return lhs().then((value) => {
              debug('testing equality function',params,value);
              if (typeof params === 'function') {
                debug('executing',params,value);
                return params(value);
              }
              else {
                return params == value;
              }
            })
          })

        };
      }
      else if (this.isFunction(lhs)){
        debug ('Constructing function %s', keys[0],rhs)
        return (value) => {
          debug('RHS',rhs);
          return rhs().then((params) => {
            debug('FUNCTION',lhs)
            debug ('Params',value,params);

            let test = lhs(value, params);
            debug('Result ',test);
            return test;
          });
        }
      }*/

    }
    else {
      let andArray=[];
      for (let prop in obj) {
        let newQuery = {};
        newQuery[prop] = obj[prop];
        andArray.push(newQuery);
      }
      return this._parseObject({$and:andArray});
    }
  }

  parse(value) {
    debug('-->Parsing', value);
    let retVal;
    if (isArray(value)) {
      return this._parseArray(value);
    }
    if (typeof value === 'object') {
      return this._parseObject(value);
    }

    if (this._funcs.hasOwnProperty(value)) {
      retVal = this._funcs[value];
    }
    else {
      try {
        let parseResult =Promise.resolve(JSON.parse(value));
        retVal = identityFunc(() => parseResult);
      }
      catch (e) {
        retVal = identityFunc(() => (this._resolve(value)));
      }
    }
    debug('Parsing Result', value, retVal.name);
    return retVal;

  }

  run(query) {
    throw ('not implemented');
  }

}

module.exports = exports = UsExpression;

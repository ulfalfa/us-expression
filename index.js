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


  identityFunc(resolveFunc, value) {
    debug ('C$ID$ ResolveFunc',resolveFunc, typeof resolveFunc);
    debug ('C$ID$ Value',value, typeof value);

    return (checkValue) => {
      debug ('E$ID$()', checkValue, typeof checkValue);
      if (typeof checkValue !=='function') {
        debug ('Since it\'s not a function -> parse');
        checkValue=this.parse(checkValue);
      }

      return checkValue(undefined).then((valueToCheck) => {
        debug ('valueToCheck is', valueToCheck);
        if (typeof (valueToCheck)==='undefined') {
          return resolveFunc(value);
        }
        else {
          return resolveFunc(value)
              .then((valueResolved) => (valueResolved===valueToCheck))
        }
      });
    }
  }


  parse(value) {
    debug('-->Parsing', value);
    let retVal;

    if (typeof value ==='undefined') {
      return () => Promise.resolve();
    }
    else if (isArray(value)) {
      retVal = this._parseArray(value);
    }
    else if (typeof value === 'object') {
      retVal = this._parseObject(value);
    }
    else if (this._funcs.hasOwnProperty(value)) {
      retVal = this._funcs[value];
    }
    else {
      try {
        let parseResult =Promise.resolve(JSON.parse(value));
        debug (value, 'is a fixed value');
        retVal = this.identityFunc(Promise.resolve.bind(Promise), parseResult);
      }
      catch (e) {
        debug (value, 'seems to be a variable that must be resolved');
        retVal = this.identityFunc(this._resolve.bind(this), Promise.resolve(value));
      }
    }
    debug('Parsing Result', value, retVal.name);
    assert (typeof retVal === 'function')
    return retVal;

  }

  run(query) {
    throw ('not implemented');
  }

}

module.exports = exports = UsExpression;

/* eslint no-invalid-this: 0, no-unused-expressions:0 */
/* eslint-env node, mocha */
'use strict';
const chai = require('chai');
const expect    = chai.expect;

const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);


/*let sinon = require('sinon');
let sinonChai = require('sinon-chai');
chai.use(sinonChai);*/
const util = require('util');
function inspect(object) {
  return util.inspect(object, {
    showHidden: true,
    depth: null,
    colors: true
  });
}

const debug= require('debug')('us.expression.test');

/*function inspect(object) {
  return util.inspect(object, {showHidden:false, depth:null, colors:true});
}*/

const variables = {
  foo: true,
  bar: false,
  baz: 6,
  testString:'test'

}
function resolve(varName) {
  return Promise.resolve(variables[varName]);
}

describe ('USExpression', function () {
  const USExpression  = require('../index');

  before( function () {
    this.exp = new USExpression(resolve);
  });


  describe('handles input variables', function () {

    it('can parse a input value (string)',function () {
      let result = this.exp.parse('"test"');
      expect (result).to.be.a('function');
      return Promise.all([
        expect(result()).to.become('test'),
        expect(result('test')).to.be.eventually.equal(true),
        expect(result('nottest')).to.become(false)
      ]);
    });
    it('can parse a input value (number)',function () {
      let result = this.exp.parse(100);
      expect (result).to.be.a('function');
      return Promise.all([
        expect(result()).to.become(100),
        expect(result(100)).to.be.eventually.equal(true),
        expect(result(101)).to.become(false)
      ]);
    });
    it('can parse a input value (boolean)',function () {
      let result = this.exp.parse(true);
      expect (result).to.be.a('function');
      return Promise.all([
        expect(result()).to.become(true),
        expect(result(true)).to.be.eventually.equal(true),
        expect(result(false)).to.become(false)
      ]);
    });
  });


  it('can parse a function name', function () {
    let result = this.exp.parse('$eq');
    expect (result).to.be.a('function');
    debug ('Function',inspect(result));
  });

  it('can parse an array', function () {
    let result = this.exp.parse(['"test"','baz',true,false,-1,10])();
    debug('array conv', result);
    expect (result).to.be.a('promise');

    return result
      .then((arrayOfPromises) => {
        expect (arrayOfPromises[5]).to.be.a('function');
        return Promise.all(arrayOfPromises.map((func) => func()))
          .then ((value) => {
            expect(value).to.be.deep.equal(['test',6,true,false,-1,10]);
          });

      })


  });
  it('can parse an object with one key (equality function)', function () {
    let testArray = Promise.all([
      this.exp.parse({'"test"':'"test"'})(),
      this.exp.parse({'"test"':'"testx"'})(),
      this.exp.parse({"baz":6})(),
      this.exp.parse({"baz":7})()
    ]);
    return expect(testArray).to.become([true,false,true,false]);
  });


  it('can parse an object with one key (function on lhs)', function () {
    let result = this.exp.parse({'$eq':'"test"'});
    return expect(Promise.all([
      result('test'),
      result('notest')
    ])).to.become([true,false]);
  });
  it('can parse an object with one key (function $lt on lhs)', function () {
    let result = this.exp.parse({'$lte':4});
    return expect(Promise.all([
      result(3),
      result(4),
      result(5)
    ])).to.become([true,true,false]);
  });
  it.only('is reusable and fetches always new', function () {
    variables.testVar= 123;
    let result = this.exp.parse({'$eq':'testVar'});

    expect (result).to.be.a('function');
    return result(123)
      .then((value) => {
        debug('reuse res',value);
        expect(value).to.be.true;
        variables.testVar= 100;
        return result(123)
      })
      .then((value) => {
        debug('reuse res2: ',value);
        return expect(value).to.be.false;

      })
  });


  xit('can parse an object with lhs $and (only one key)', function () {
    let result = this.exp.parse({'$and':[{'"test"':'"test"'},true]});
    expect (result).to.be.a('function');
    debug('$and function', result);

    return result('test')
      .then((value) => {
        debug('result', value);
        expect(value).to.be.true;
        return this.exp.parse({'$and':[{'"test"':"nottest"},true]})(false);
      })
      .then((value) => {
        debug('result', value);
        expect(value).to.be.false;
        return;
      })
  });
  xit('can parse an object with lhs $or (only one key)', function () {
    let result = this.exp.parse({'$or':[{'"test"':'"test"'},false]});
    expect (result).to.be.a('function');
    return result('test')
      .then((value) => {
        expect(value).to.be.true;
        return this.exp.parse({'$and':[{'"test"':"nottest"},false]})('test');
      })
      .then((value) => {
        expect(value).to.be.false;
        return result();
      })
  });

  xit ('implicitly makes and $and function', function () {
    //let expression = this.exp.parse({foo:true,5:{$lt:'baz'},$or:[true,false]});
    let expression = this.exp.parse({5:{$lt:'baz'}});

    return expression()
      .then((result) => {
        expect(result).to.be.true;
      })


  });


});

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
  debug ('RESOLVING', varName);
  return Promise.resolve(variables[varName]);
}

describe ('USExpression', function () {
  const USExpression  = require('../index');

  before( function () {
    this.exp = new USExpression(resolve);
  });

  describe('parsing and compiling of values', function (){

    it('can parse a value', function (){
      return (Promise.all([
        expect(this.exp._parseValue()).to.become(undefined),
        expect(this.exp._parseValue(true)).to.become(true),
        expect(this.exp._parseValue('true')).to.become(true),
        expect(this.exp._parseValue(false)).to.become(false),
        expect(this.exp._parseValue('false')).to.become(false),
        expect(this.exp._parseValue(123.45)).to.become(123.45),
        expect(this.exp._parseValue('123.45')).to.become(123.45),
        expect(this.exp._parseValue('baz')).to.become(6),
        expect(this.exp._parseValue('"baz"')).to.become('baz'),
      ]));
    });
    it('can compile a value to an identity function', function (){

      return (Promise.all([
        expect(this.exp._compileValueExpression(true)(true)).to.become(true),
        expect(this.exp._compileValueExpression(true)(false)).to.become(false),
        expect(this.exp._compileValueExpression(123.45)(123.45)).to.become(true),
        expect(this.exp._compileValueExpression(123.45)(543.21)).to.become(false),
        expect(this.exp._compileValueExpression('baz')('baz')).to.become(true),
        expect(this.exp._compileValueExpression('baz')(6)).to.become(true),
        expect(this.exp._compileValueExpression('baz')('bar')).to.become(false),
      ]));
    });
    it('the compilation result can be reused and is evaluated again', function (){
      let expression = this.exp._compileValueExpression('baz');
      let cases =[];
      cases.push(expect(expression(6)).to.eventually.be.equal(true));
      variables.baz = 5;
      cases.push(expect(expression(6)).to.eventually.be.equal(false));
      cases.push(expect(expression(5)).to.eventually.be.equal(true));
      variables.baz = 6;
      cases.push(expect(expression(6)).to.eventually.be.equal(true));
      return Promise.resolve(cases);
    });

  });

  describe('built in functions (non logical)', function (){
    it('it has a $eq function', function (){
      let expression = this.exp._parseFunction('$eq');
      expect(expression.name).to.be.equal('$eq');
      expect(expression.length).to.be.equal(2);
      expect(expression(3,3)).to.be.equal(true);
      expect(expression(3,4)).to.be.equal(false);
    });
    it('it has a $neq function', function (){
      let expression = this.exp._parseFunction('$neq');
      expect(expression.name).to.be.equal('$neq');
      expect(expression.length).to.be.equal(2);
      expect(expression(3,3)).to.be.equal(false);
      expect(expression(3,4)).to.be.equal(true);
    });
    it('it has a $gt function', function (){
      let expression = this.exp._parseFunction('$gt');
      expect(expression.name).to.be.equal('$gt');
      expect(expression.length).to.be.equal(2);
      expect(expression(3,3)).to.be.equal(false);
      expect(expression(3,4)).to.be.equal(false);
      expect(expression(4,3)).to.be.equal(true);
    });
    it('it has a $gte function', function (){
      let expression = this.exp._parseFunction('$gte');
      expect(expression.name).to.be.equal('$gte');
      expect(expression.length).to.be.equal(2);
      expect(expression(3,3)).to.be.equal(true);
      expect(expression(3,4)).to.be.equal(false);
      expect(expression(4,3)).to.be.equal(true);
    });
    it('it has a $lt function', function (){
      let expression = this.exp._parseFunction('$lt');
      expect(expression.name).to.be.equal('$lt');
      expect(expression.length).to.be.equal(2);
      expect(expression(3,3)).to.be.equal(false);
      expect(expression(3,4)).to.be.equal(true);
      expect(expression(4,3)).to.be.equal(false);
    });
    it('it has a $lte function', function (){
      let expression = this.exp._parseFunction('$lte');
      expect(expression.name).to.be.equal('$lte');
      expect(expression.length).to.be.equal(2);
      expect(expression(3,3)).to.be.equal(true);
      expect(expression(3,4)).to.be.equal(true);
      expect(expression(4,3)).to.be.equal(false);
    });
    it('it has a $in function', function (){
      let expression = this.exp._parseFunction('$in');
      expect(expression.name).to.be.equal('$in');
      expect(expression.length).to.be.equal(2);
      expect(expression(3,[1,2,3,4])).to.be.equal(true);
      expect(expression(3,[1,2,4])).to.be.equal(false);
    });
    it('it has a $nin function', function (){
      let expression = this.exp._parseFunction('$nin');
      expect(expression.name).to.be.equal('$nin');
      expect(expression.length).to.be.equal(2);
      expect(expression(3,[1,2,3,4])).to.be.equal(false);
      expect(expression(3,[1,2,4])).to.be.equal(true);
    });
    it('it has a $not function', function (){
      let expression = this.exp._parseFunction('$not');
      expect(expression.name).to.be.equal('$not');
      expect(expression.length).to.be.equal(2);
      expect(expression('NOTUSED',true)).to.be.equal(false);
      expect(expression('NOTUSED',false)).to.be.equal(true);
    });


  });
  describe('parsing and compiling of functions (non logical)', function (){
    it('the parses a simple function', function (){
      let expression = this.exp._parseFunction('$eq');
      expect(expression.name).to.be.equal('$eq');
      expect(expression.length).to.be.equal(2);
    });


    it('compiles a function', function () {
      let expression = this.exp._compileObject({$eq:'baz'});
      return Promise.all([expect(expression('baz')).to.eventually.be.equal(true),
        expect(expression(6)).to.eventually.be.equal(true),
        expect(expression(5)).to.eventually.be.equal(false)]);
    });

    it('the compilation can be reused', function () {
      let expression = this.exp._compileObject({$eq:'baz'});
      let cases =[];
      cases.push(expect(expression(6)).to.eventually.be.equal(true));
      variables.baz = 5;
      cases.push(expect(expression(6)).to.eventually.be.equal(false));
      cases.push(expect(expression(5)).to.eventually.be.equal(true));
      variables.baz = 6;
      cases.push(expect(expression(6)).to.eventually.be.equal(true));
      return Promise.resolve(cases);
    });

  });
  describe('parsing and compiling of arrays', function (){
    it('parsing arrays', function (){
      return (Promise.all([
        expect(this.exp._parseArray()).to.be.rejectedWith(Error,/must be an array/),
        expect(this.exp._parseArray([])).to.become([]),
        expect(this.exp._parseArray([true,'baz','"baz"',6,{$eq:6}]))
          .to.become([true,6,'baz',6,{$eq:6}]),
      ]));

    });
    it('compiling arrays undefined/empty', function (){
      let fn = function () {
        throw 'checked';
      }
      expect(() => {
        this.exp._compileArray()
      }).to.throw(/array/);
      expect(this.exp._compileArray([])).to.be.deep.equal([]);

      let funcArray = this.exp._compileArray(['baz','"bar"',6,true,{$eq:'baz'}]);
      expect(funcArray.length).to.be.equal(5);
      expect(funcArray[0]).to.be.a('function');
      expect(funcArray[1]).to.be.a('function');
      expect(funcArray[2]).to.be.a('function');
      expect(funcArray[3]).to.be.a('function');
      expect(funcArray[4]).to.be.a('function');

      let resultArray = Promise.all(funcArray.map((func) => func(6)));
      return expect(resultArray).to.become([true,false,true,false,true]);

    });

  });
  describe('compiling $and / $or function', function (){
    it('compile $and function', function (){
      let $andFunc = this.exp._compileObject({$and:['baz',6,{$eq:'baz'},{$gt:5}]});
      debug('Result of compilation', $andFunc);
      return Promise.all([
        expect($andFunc(6)).to.become(true),
        expect($andFunc(5)).to.become(false),
      ]);

    });
    it('compile $or function', function (){
      debug ('$OR FUNCTION');
      let $orFunc = this.exp._compileObject({$or:[{$gt:5},'baz',6,{$eq:'baz'}]});
      debug('Result of compilation', $orFunc);
      debug('Result of compilation', $orFunc);
      debug('Result of compilation', $orFunc);
      debug('Result of compilation', $orFunc);
      return Promise.all([
        expect($orFunc(5)).to.become(false),
        expect($orFunc(7)).to.become(true),
        expect($orFunc(6)).to.become(true),
      ]);

    });

  });

});

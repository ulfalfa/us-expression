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
  testString:'test',
  'test/ /test':{foo:{bar:'HELLO WORLD'}},
  'test/state':{val:'true',old:'true',ts:123,lc:234}

}
function resolve(varName) {
  debug ('RESOLVING', varName);
  return Promise.resolve(variables[varName]);
}

describe('USExpression', function () {
  const USExpression  = require('../index');

  before( function () {
    this.exp = new USExpression(resolve);
  });

  describe('resolving capabilities', function (){

    it('resolves an object',function (){
      return expect(this.exp._resolve('test/ /test')).to.become({foo:{bar:'HELLO WORLD'}});

    });
    it('resolves an object with path access',function (){
      return expect(this.exp._resolve('test/ /test[foo]')).to.become({bar:'HELLO WORLD'});
    });
    it('resolves an object with deep path access',function (){
      return expect(this.exp._resolve('test/ /test[foo.bar]')).to.become('HELLO WORLD');
    });

  });

  describe('_normalize function',function (){

    it('normalizes simple types',function (){
      expect(this.exp._normalize('test')).to.be.deep.equal({$eq:'test'});
      expect(this.exp._normalize('"test"')).to.be.deep.equal({$eq:'"test"'});
      expect(this.exp._normalize(true)).to.be.deep.equal({$eq:true});
      expect(this.exp._normalize(false)).to.be.deep.equal({$eq:false});
      expect(this.exp._normalize(123.45)).to.be.deep.equal({$eq:123.45});
    });
  });

  describe('compilation of simple operations', function () {
    it('returns $eq function', function (){
      let testFunc=this.exp._compileSimpleOperator.bind(this.exp);
      return Promise.all([
        expect(testFunc('testString','$eq','"test"')()).to.become(true),
        expect(testFunc(true,'$eq','bar')()).to.become(false)
      ]);

    });
    it('returns $gt function', function (){
      let testFunc=this.exp._compileSimpleOperator.bind(this.exp);
      return Promise.all([
        expect(testFunc('baz','$gt',5)()).to.become(true),
        expect(testFunc(5,'$gt','baz')()).to.become(false)
      ]);

    });
    it('returns $gte function', function (){
      let testFunc=this.exp._compileSimpleOperator.bind(this.exp);
      return Promise.all([
        expect(testFunc('baz','$gte',5)()).to.become(true),
        expect(testFunc('baz','$gte',6)()).to.become(true),
        expect(testFunc(5,'$gte','baz')()).to.become(false)
      ]);

    });
    it('returns $lt function', function (){
      let testFunc=this.exp._compileSimpleOperator.bind(this.exp);
      return Promise.all([
        expect(testFunc('baz','$lt',5)()).to.become(false),
        expect(testFunc(5,'$lt','baz')()).to.become(true)
      ]);

    });
    it('returns $lte function', function (){
      let testFunc=this.exp._compileSimpleOperator.bind(this.exp);
      return Promise.all([
        expect(testFunc('baz','$lte',5)()).to.become(false),
        expect(testFunc('baz','$lte',6)()).to.become(true),
        expect(testFunc(5,'$lte','baz')()).to.become(true)
      ]);

    });
    it('returns $in function', function (){
      let testFunc=this.exp._compileSimpleOperator.bind(this.exp);
      return Promise.all([
        expect(testFunc('baz','$in',[6,'baz',5])()).to.become(true),
        expect(testFunc(6,'$in',['baz',6])()).to.become(true),
        expect(testFunc(6,'$in',['bar',5])()).to.become(false),
      ]);
    });
  });

  describe('compile function',function (){

    it('only accepts objects as query',function (){
      expect(this.exp.compile.bind(this,'test'))
      .to.throw(/query must be an object/);
      expect(this.exp.compile.bind(this,[]))
      .to.throw(/query must not be an array/);
    });

    it('handles single field:field',function (){
      let result = this.exp.compile({'baz':6});
      return expect(result()).to.become(true);
    });
    it('handles multi field:field',function (){
      let result = this.exp.compile({6:'baz',true:false});
      return expect(result()).to.become(false);
    });
    it('handles multi operations',function (){
      let result = this.exp.compile(
        {6:{$gt:5},true:true,
          $and:[{false:'bar'},{true:true}]});
      return expect(result()).to.become(true);
    });
    it('handles $or operations',function (){
      let result = this.exp.compile(
        {$or:[
          {6:{$gt:5},false:true},
          {true:'bar'},
          {true:true}]});
      return expect(result()).to.become(true);
    });
    it('handles $not operations',function (){
      let result = this.exp.compile(
        {$not:{$or:[
          {6:{$gt:5},false:true},
          {true:'bar'},
          {true:true}]}});
      return expect(result()).to.become(false);
    });
    it('handles path accessed fields operations',function (){
      let result = this.exp.compile(
        {'test/ /test[foo.bar]':'"HELLO WORLD"'});
      return expect(result()).to.become(true);
    });

    it('can register custom functions',function (){

      //let result = this.exp.compile({'test/state[old]':{$neq:'test/state[val]'}});
      this.exp.registerFunction ('$changed',(value, params) => {
        debug ('params', params);
        return value.val !== value.old;
      });
      let result = this.exp.compile({'test/state':{$changed:['baz','"TEST"']}});

      return expect(result()).to.become(false);
    });

  });

  describe.only('listing used variables', function () {


    it ('lists uses variables after compile', function () {
      variables.foo = true;
      variables.bar = false;
      variables.baz = 6;
      variables.testString = 'test';
      variables.testObj = {val:'foobar',old:'baz'};
      let Exp = new USExpression(resolve);
      let expression = Exp.compile({$and:[{true:false},{'testObj[val]':'"foobar"'},{'testObj[old]':'"baz"'},{true:true},{foo:true},{bar:false},{baz:6},{testString:'"test"'}]});
      expect(expression.fields).to.be.deep.equal(['testObj','foo','bar','baz','testString']);
      return expect(expression()).to.become(false);

    });
  });
})

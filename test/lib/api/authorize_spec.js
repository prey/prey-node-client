var sinon   = require('sinon'),
    should  = require('should'),
    api     = require('./../../../lib/api'),
    api_req = require('./../../../lib/api/request');


describe('authorize', function() {

  describe('with no params', function(){

    it('throws', function() {
      (function(){
        api.accounts.authorize()
      }).should.throw('No credentials passed!')
    })

  })

  describe('with invalid params', function(){

    var stub;

    before(function(){
      stub = sinon.stub(api_req, 'get', function(path, opts, cb) {
        cb(null, { statusCode: 401 });
      })
    })

    after(function(){
      stub.restore();
    })

    it('callsback an error', function(done){

      api.accounts.authorize({ username: 'foo', password: 'x' }, function(err) {
        err.should.exist;
        err.code.should.equal('INVALID_CREDENTIALS');
        done();
      })
    })

  })

  describe('with valid params', function() {

    var stub,
        key    = 'abcdef123456',
        params = { username: 'valid', password: 'valid' };

    before(function(){
      stub = sinon.stub(api_req, 'get', function(path, opts, cb) {
        var body = { user: { key: key } };
        cb(null, { body: body }, body);
      })
    })

    after(function(){
      stub.restore();
    })

    describe('and key is not set', function(){

      beforeEach(function(){
        api.keys.unset('api'); // otherwise next test fails
      })

      it('returns key', function(done){
        api.accounts.authorize(params, function(err, keys) {
          should.not.exist(err);
          keys.should.have.keys('api');
          keys.api.should.equal(key);
          done();
        })
      })

      it('sets key internally', function(done){
        var spy = sinon.spy(api.keys, 'set');

        api.accounts.authorize(params, function(err, keys) {
          should.not.exist(err);
          spy.calledWith({ api: key }).should.be.true;
          spy.restore();
          done();
        })
      })

    })

    describe('and key is already set', function(){

      beforeEach(function(){
        api.keys.set({ api: 'foobar' })
      })

      it('throws', function() {
        (function(){
          api.accounts.authorize(params, function(){ /* noop */ })
        }).should.throw('API key already set!')
      })

    })

  })


})

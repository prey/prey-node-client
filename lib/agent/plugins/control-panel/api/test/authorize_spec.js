var sinon   = require('sinon'),
    should  = require('should'),
    api     = require('..'),
    api_req = require('../request');

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
      stub = sinon.stub(api_req, 'post', function(path, data, opts, cb) {
        cb(null, { statusCode: 401 });
      })
    })

    after(function(){
      stub.restore();
    })

    it('callsback an error', function(done){

      api.accounts.authorize({ email: 'foo', password: 'x' }, function(err) {
        err.should.exist;
        err.code.should.equal('UNPROCESSABLE_DATA');
        done();
      })
    })

  })

  describe('with valid params', function() {

    var stub,
        key    = 'abcdef123456',
        params = { email: 'valid@email.com', password: 'validpass' };

    before(function(){
      stub = sinon.stub(api_req, 'post', function(path, data, opts, cb) {
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
        api.accounts.authorize(params, function(err, res) {
          should.not.exist(err);
          // keys.should.have.keys('api');
          res.should.equal(key);
          done();
        })
      })

      it('sets key internally', function(done){
        var spy = sinon.spy(api.keys, 'set');

        api.accounts.authorize(params, function(err, res) {
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

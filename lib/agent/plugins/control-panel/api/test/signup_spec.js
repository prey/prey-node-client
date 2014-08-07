var sinon   = require('sinon'),
    should  = require('should'),
    api     = require('..'),
    api_req = require('../request');

var signup  = api.accounts.signup; // shortcut

var stub_post = function(body, code) {
  return sinon.stub(api_req, 'post', function(path, data, opts, cb) {
    var resp = { statusCode: (code || 200), body: body };
    cb(null, resp, body);
  })
}

describe('signup', function() {

  before(function(){
    api.keys.unset('api');
  })

  describe('with no params', function(){

    it('throws', function() {
      (function(){
        signup()
      }).should.throw('Empty data.')
    })

  })

  describe('and key is already set', function(){

    beforeEach(function(){
      api.keys.set({ api: 'foobar' })
    })

    it('throws', function() {
      (function(){
        signup({ username: 'paul mccartney' }, function(){ /* noop */ })
      }).should.throw('API key already set!')
    })

  })

  describe('and key is not set', function(){

    beforeEach(function(){
      api.keys.unset('api'); // otherwise next test fails
    })

    describe('with invalid params', function(){

      it('callsback an error', function(done){

        signup({ knock: 'knock' }, function(err) {
          err.should.exist;
          err.code.should.equal('VALIDATION_ERROR');
          done();
        })
      })

      it('should not send request', function(done){
        var spy = sinon.spy(api_req, 'post');

        signup({ username: 'somebody', email: null }, function(err) {
          err.should.exist;
          spy.called.should.be.false;
          spy.restore()
          done();
        })

      })

    })

    describe('with valid params', function() {

      var stub,
          key     = 'abcdef123456',
          params  = {
            name: 'peter',
            email: 'hey@gmail.com',
            password: 'johnnycash'
          };

      describe('and failed response', function() {

        before(function(){
          var body = 'PICOPALQUELEE';
          stub = stub_post(body, 422);
        })

        after(function(){
          stub.restore();
        })

        it('callbacks error', function(done){

          signup(params, function(err, key) {
            should.exist(err);
            err.code.should.equal('UNPROCESSABLE_DATA');
            done();
          })
        })

        it('sets nothing', function(done){
          var spy = sinon.spy(api.keys, 'set');

          signup(params, function(err, res) {
            should.exist(err);
            should.not.exist(res);
            spy.called.should.be.false;
            spy.restore();
            done();
          })
        })

      })

      describe('and valid response', function(){

        before(function(){
          var body = { user: { key: key } };
          stub = stub_post(body, 200);
        })

        after(function(){
          stub.restore();
        })

        it('returns key', function(done){
          signup(params, function(err, res) {
            should.not.exist(err);
            res.should.equal(key);
            done();
          })
        })

        it('sets key internally', function(done){
          var spy = sinon.spy(api.keys, 'set');

          signup(params, function(err, res) {
            should.not.exist(err);
            spy.calledWith({ api: key }).should.be.true;
            spy.restore();
            done();
          })

        })

      })

    })

  })

})

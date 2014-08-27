var sinon   = require('sinon'),
    should  = require('should'),
    needle  = require('needle'),
    api_req = require('../request');

describe('API Request Wrapper', function() {

  describe('.use', function() {

    it('overrides defaults', function() {
      var defaults = api_req.use({ host: 'http://foobar.com' });
      defaults.host.should.equal('http://foobar.com');
    })

  })

  describe('get', function() {

    var stub;

    describe('on a 200 response', function() {

      before(function() {
        stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {
          cb(null, { statusCode: 200 });
        })
      })

      after(function() {
        stub.restore();
      })

      it('does not retry the request', function(done) {

        api_req.get('/devices/something', {}, function(err, resp, body) {
          stub.callCount.should.equal(1);
          done();
        })

      })

    })

    describe('on a 503 response', function() {

      before(function() {
        stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {
          cb(new Error('socket hang up'));
        })
      })

      after(function() {
        stub.restore();
      })

      it('retries the request', function(done) {

        api_req.get('/devices/something', {}, function(err, resp, body) {
          stub.callCount.should.equal(3);
          done();
        })

      })

    })

    describe('on connection error', function() {

      before(function() {
        stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {
          cb(new Error('socket hang up'));
        })
      })

      after(function() {
        stub.restore();
      })

      it('retries the request', function(done) {

        api_req.get('/devices/something', {}, function(err, resp, body) {
          stub.callCount.should.equal(3);
          done();
        })

      })

    })

  })

});

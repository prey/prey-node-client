var sinon   = require('sinon'),
    should  = require('should'),
    needle  = require('needle'),
    api_req = require('./../../../lib/api/request');

describe('API Request Wrapper', function() {

  describe('.use', function() {

    it('overrides defaults', function() {
      var defaults = api_req.use({ host: 'http://foobar.com' });
      defaults.host.should.equal('http://foobar.com');
    })

  })

  describe('get', function() {

    describe('on connection error', function() {

      var stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {
        cb(new Error('socket hang up'));
      })

      it('retries the request', function(done) {

        api_req.get('/devices/something', {}, function(err, resp, body) {
          stub.callCount.should.equal(3);
          stub.restore();
          done();
        })

      })

    })

  })

});

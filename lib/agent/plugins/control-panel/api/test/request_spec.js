var sinon   = require('sinon'),
    should  = require('should'),
    needle  = require('needle'),
    api_req = require('../request');

describe('API Request Wrapper', function() {

  describe('.use', function() {

    it('overrides defaults', function() {
      var defaults = api_req.use({
        host: 'http://foobar.com',
        retry_timeout: 100
      });
      defaults.host.should.equal('http://foobar.com');
    });

  });

  describe('get', function() {

    var stub;

    describe('on a 200 response', function() {

      before(function() {
        stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {
          cb(null, { statusCode: 200 });
        });
      });

      after(function() {
        stub.restore();
      });

      it('does not retry the request', function(done) {

        api_req.get('/devices/something', {}, function(err, resp, body) {
          stub.callCount.should.equal(1);
          done();
        });

      });

    });

    describe('on a 503 response', function() {

      describe('without proxy', function () {

        before(function() {
          stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {
            cb(new Error('socket hang up'));
          });
        });

        after(function() {
          stub.restore();
        });

        it('retries the request', function(done) {

          // 3 second interval between requests
          this.timeout(9000);

          api_req.get('/devices/something', {}, function(err, resp, body) {
            stub.callCount.should.equal(3);
            done();
          });

        });

      });

      describe('with proxy', function () {

        before(function() {
          stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {

            var err = new Error('socket hang up');
            err.with_proxy = true;

            if(!opts.proxy) {
              // last 3 retries should not have proxy set
              err.with_proxy = false;
            }

            cb(err);
          });
        });

        after(function() {
          stub.restore();
        });

        it('retries the request both with and without proxy', function(done) {

          // 3 second interval between requests
          this.timeout(18000);

          api_req.get('/devices/something', { proxy: "http://127.0.0.1" }, function(err, resp, body) {
            stub.callCount.should.equal(6);
            err.with_proxy.should.equal(false);
            done();
          });

        });
      });

    });

    describe('on network error', function() {

      describe('with proxy', function () {

        describe('and non-proxy returning network error', function () {

          before(function() {
            stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {
              var err = new Error('EHOSTUNREACH');
              err.code = 'EHOSTUNREACH';
              cb(err);
            });
          });

          after(function() {
            stub.restore();
          });

          it('retries the request without proxy only once', function(done) {

            this.timeout(3000);

            api_req.get('/devices/something', { proxy: "http://127.0.0.1" }, function(err, resp, body) {
              stub.callCount.should.equal(2);
              done();
            });

          });

        });

        describe('and non-proxy connection returning 503', function () {

          before(function() {
            stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {
              if (opts.proxy) {
                var err = new Error('EHOSTUNREACH');
                err.code = 'EHOSTUNREACH';
                cb(err);
              } else {
                cb(new Error('socket hang up'));
              }
            });
          });

          after(function() {
            stub.restore();
          });

          it('retries the request 4 times', function(done) {

            this.timeout(12000);

            api_req.get('/devices/something', { proxy: "http://127.0.0.1" }, function(err, resp, body) {
              stub.callCount.should.equal(4);
              done();
            });

          });

        });

      });

      describe('without proxy', function () {

        before(function() {
          stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {
            cb(new Error('EHOSTUNREACH'));
          });
        });

        after(function() {
          stub.restore();
        });

        it('does not retry the request', function(done) {

          api_req.get('/devices/something', {}, function(err, resp, body) {
            stub.callCount.should.equal(1);
            done();
          });

        });

      });

    });

  });

});

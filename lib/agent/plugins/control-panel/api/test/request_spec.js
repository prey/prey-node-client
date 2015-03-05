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

    var set_proxy = function () {
      var defaults = api_req.use({
        try_proxy: "http://127.0.0.1",
        retry_timeout: 100
      });
    };

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

          api_req.get('/devices/something', {}, function(err, resp, body) {
            stub.callCount.should.equal(3);
            done();
          });

        });

      });

      describe('with proxy', function () {

        var proxies = [];

        before(function() {
          stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {

            var err = new Error('socket hang up');

            proxies.push(opts.proxy);

            cb(err);
          });
        });

        after(function() {
          stub.restore();
        });

        it('retries the request both with and without proxy', function(done) {

          set_proxy();

          api_req.get('/devices/something', {}, function(err, resp, body) {
            stub.callCount.should.equal(6);
            proxies.should.eql([ 'http://127.0.0.1',
              'http://127.0.0.1',
              'http://127.0.0.1',
              undefined,
              undefined,
              undefined
            ]);
            done();
          });

        });
      });

    });

    describe('on network error', function() {

      describe('with proxy', function () {

        describe('and non-proxy returning network error', function () {

          var proxies = [];

          before(function() {
            stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {
              var err = new Error('EHOSTUNREACH');
              err.code = 'EHOSTUNREACH';

              proxies.push(opts.proxy);

              cb(err);
            });
          });

          after(function() {
            stub.restore();
          });

          it('retries the request without proxy only once', function(done) {

            set_proxy();

            api_req.get('/devices/something', {}, function(err, resp, body) {
              stub.callCount.should.equal(2);
              proxies.should.eql([
                'http://127.0.0.1',
                undefined ]);
              done();
            });

          });

        });

        describe('and non-proxy connection returning 503', function () {

          var proxies = [];

          before(function() {
            stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {

              proxies.push(opts.proxy);

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

            set_proxy();

            api_req.get('/devices/something', {}, function(err, resp, body) {
              stub.callCount.should.equal(4);
              proxies.should.eql([ 'http://127.0.0.1',
                undefined,
                undefined,
                undefined
              ]);
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

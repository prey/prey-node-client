var sinon   = require('sinon'),
    should  = require('should'),
    needle  = require('needle'),
    api_req = require('../request');

describe('API Request Wrapper', function() {

  describe('get', function() {

    describe('with proxy', function () {

      before(function () {

        api_req.use({
          try_proxy: "http://127.0.0.1",
          retry_timeout: 100
        });

      });

      describe('on 200', function () {

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
            resp.statusCode.should.equal(200);
            stub.callCount.should.equal(1);
            done();
          });

        });

      });

      describe('on temp error + 200 response', function () {

        var proxies = [];

        before(function() {
          stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {

            proxies.push(opts.proxy);

            if(opts.proxy) {
              cb(new Error('socket hang up'));
            } else {
              cb(null, { statusCode: 200 });
            }
          });
        });

        after(function() {
          stub.restore();
        });

        it('tries 3 times with proxy and 1 without proxy', function(done) {

          api_req.get('/devices/something', {}, function(err, resp, body) {
            resp.statusCode.should.equal(200);
            proxies.should.eql([
              'http://127.0.0.1',
              'http://127.0.0.1',
              'http://127.0.0.1',
              undefined
            ]);
            stub.callCount.should.equal(4);
            done();
          });

        });

      });

      describe('on [temp error + network down] + 200 response', function () {

        var proxies = [];

        before(function() {

          stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {

            proxies.push(opts.proxy);

            if(opts.proxy) {

              if(this.request.callCount === 3) {

                var err = new Error('EHOSTUNREACH');
                err.code = 'EHOSTUNREACH';
                cb(err);

              } else {
                cb(new Error('socket hang up'));
              }

            } else {
              cb(null, { statusCode: 200 });
            }

          });

        });

        after(function() {
          stub.restore();
        });

        it('tries 3 times with proxy and 1 without proxy', function(done) {

          api_req.get('/devices/something', {}, function(err, resp, body) {
            resp.statusCode.should.equal(200);
            proxies.should.eql([
              'http://127.0.0.1',
              'http://127.0.0.1',
              'http://127.0.0.1',
              undefined
            ]);
            stub.callCount.should.equal(4);
            done();
          });

        });

      });

      describe('on network down + [temp error + 200 response]', function () {

        var proxies = [];

        before(function() {

          stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {

            proxies.push(opts.proxy);

            if(opts.proxy) {

              var err = new Error('EHOSTUNREACH');
              err.code = 'EHOSTUNREACH';
              cb(err);

            } else {

              if(this.request.callCount === 4) {
                cb(null, { statusCode: 200 });
              } else {
                cb(new Error('socket hang up'));
              }

            }

          });

        });

        after(function() {
          stub.restore();
        });

        it('tries once with proxy and 3 without proxy', function(done) {

          api_req.get('/devices/something', {}, function(err, resp, body) {
            resp.statusCode.should.equal(200);
            proxies.should.eql([
              'http://127.0.0.1',
              undefined,
              undefined,
              undefined
            ]);
            stub.callCount.should.equal(4);
            done();
          });

        });

      });

      describe('on network down', function () {

        var proxies = [];

        before(function() {

          stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {

            proxies.push(opts.proxy);

            var err = new Error('EHOSTUNREACH');
            err.code = 'EHOSTUNREACH';

            cb(err);
          });
        });

        after(function() {
          stub.restore();
        });

        it('tries once with proxy and once without proxy', function(done) {

          api_req.get('/devices/something', {}, function(err, resp, body) {
            proxies.should.eql([
              'http://127.0.0.1',
              undefined
            ]);
            stub.callCount.should.equal(2);
            done();
          });

        });

      });

      describe('on temp error', function () {

        var proxies = [];

        before(function() {

          stub = sinon.stub(needle, 'request', function(method, url, data, opts, cb) {

            proxies.push(opts.proxy);

            cb(new Error('socket hang up'));
          });

        });

        after(function() {
          stub.restore();
        });

        it('tries 3 times with proxy and 3 without proxy', function(done) {

          api_req.get('/devices/something', {}, function(err, resp, body) {
            proxies.should.eql([
              'http://127.0.0.1',
              'http://127.0.0.1',
              'http://127.0.0.1',
              undefined,
              undefined,
              undefined
            ]);
            stub.callCount.should.equal(6);
            done();
          });

        });

      });

    });

  });

});
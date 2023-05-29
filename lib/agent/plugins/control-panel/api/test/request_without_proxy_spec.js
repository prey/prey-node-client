var sinon   = require('sinon'),
    should  = require('should'),
    needle  = require('needle'),
    api_req = require('../request');

describe('API Request Wrapper', function() {

  describe('get', function() {

    describe('without proxy', function () {

      // Needed when the running the whole test suit,
      // in which case defaults.proxy might have been set
      var opts = {
        proxy: ""
      };

      before(function () {

        api_req.use({
          retry_timeout: 100
        });

      });

      describe('on 200', function () {

        before(function() {
          stub = sinon.stub(needle, 'request').callsFake((method, url, data, opts, cb) => {
            cb(null, { statusCode: 200 });
          });
        });

        after(function() {
          stub.restore();
        });

        it('does not retry the request', function(done) {

          api_req.get('/devices/something', opts, function(err, resp, body) {
            resp.statusCode.should.equal(200);
            stub.callCount.should.equal(1);
            done();
          });

        });

      });

      describe('on network down', function () {

        before(function() {
          stub = sinon.stub(needle, 'request').callsFake((method, url, data, opts, cb) => {
            var err = new Error('EHOSTUNREACH');
            err.code = 'EHOSTUNREACH';
            cb(err);
          });
        });

        after(function() {
          stub.restore();
        });

        it('tries once', function(done) {

          api_req.get('/devices/something', opts, function(err, resp, body) {
            err.code.should.equal('EHOSTUNREACH');
            stub.callCount.should.equal(1);
            done();
          });

        });

      });

      describe('on temp error', function () {

        before(function() {
          stub = sinon.stub(needle, 'request').callsFake((method, url, data, opts, cb) => {
            cb(new Error('socket hang up'));
          });
        });

        after(function() {
          stub.restore();
        });

        it('tries 3 times', function(done) {

          api_req.get('/devices/something', opts, function(err, resp, body) {
            err.message.should.equal('socket hang up - Please try again in a minute.');
            stub.callCount.should.equal(3);
            done();
          });

        });

      });

      describe('on temp error + 200', function () {
        var stub2;

        before(function() {
          stub2 = sinon.stub(needle, 'request').callsFake((method, url, data, opts, cb) => {

            if(stub2.calledThrice) {
              cb(null, { statusCode: 200 });
            } else {
              cb(new Error('socket hang up'));
            }

          });
        });

        after(function() {
          stub.restore();
        });

        it('tries 3 times', function(done) {

          api_req.get('/devices/something', opts, function(err, resp, body) {
            resp.statusCode.should.equal(200);
            stub2.callCount.should.equal(3);
            done();
          });

        });

      });

      describe('on temp error + network down', function () {
        var stub2;

        before(function() {
          stub2 = sinon.stub(needle, 'request').callsFake((method, url, data, opts, cb) => {

            if(stub2.calledThrice) {
              var err = new Error('EHOSTUNREACH');
              err.code = 'EHOSTUNREACH';
              cb(err);
            } else {
              cb(new Error('socket hang up'));
            }

          });
        });

        after(function() {
          stub2.restore();
        });

        it('tries 3 times', function(done) {

          api_req.get('/devices/something', opts, function(err, resp, body) {
            err.code.should.equal('EHOSTUNREACH');
            stub2.callCount.should.equal(3);
            done();
          });

        });

      });

    });

  });

});
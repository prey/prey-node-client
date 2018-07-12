var should = require('should'),
    needle = require('needle'),
    plugin = require(__dirname + '/..');

describe('url trigger', function() {

  var obj,
      options = {};

  before(function() {
    obj = {
      config: {
        get: function(key) {
          return options[key]
        }
      },
      transports: {
        http: needle
      },
      hooks: {
        on: function(event, cb) { }
      },
      logger: {
        warn: function(str) { }
      }
    };
  })

  describe('loading', function() {

    describe('with invalid url', function() {

      it('callsback error', function(done) {
        plugin.load.call(obj, function(err) {
          err.should.be.a.Error;
          err.message.should.containEql('No URL to check!');
          done();
        });
      })

    })

    describe('with valid url', function() {

      before(function() {
        options.check_url = 'http://foobar.com';
      })

      it('doesn not callback', function(done) {
        var called = false;

        plugin.load.call(obj, function(err) {
          called = true;
        });

        setTimeout(function() {
          called.should.be.false;
          done();
        }, 10);
      })

    })

  })

  describe('requesting', function() {

    var fn;

    describe('if response is error', function() {

      before(function() {
        fn = obj.transports.http.get;
        obj.transports.http.get = function(url, opts, cb) {
          cb(new Error('No sire'));
        }
      })

      after(function() {
        obj.transports.http.get = fn;
      })

      it('does not triggers reports command', function(done) {

        var called = false;

        obj.commands = {};
        obj.commands.run = function(command, target, opts) {
          called = true;
        }

        plugin.load.call(obj);

        setTimeout(function() {
          called.should.be.false;
          done();
        }, 10)

      });

    })

    describe('if response does not match status code', function() {

      before(function() {
        fn = obj.transports.http.get;
        obj.transports.http.get = function(url, opts, cb) {
          if (cb && typeof cb == 'function')
            cb(null, { statusCode: 302 });
        }
      })

      after(function() {
        obj.transports.http.get = fn;
      })


      it('does not triggers reports command', function(done) {

        var called = false;

        obj.commands = {};
        obj.commands.run = function(command, target, opts) {
          called = true;
        }

        plugin.load.call(obj);

        setTimeout(function() {
          called.should.be.false;
          done();
        }, 10)

      });

    })

    describe('if response matches expected status code', function() {

      before(function() {
        fn = obj.transports.http.get;
        obj.transports.http.get = function(url, opts, cb) {
          cb(null, { statusCode: 404 });
        }
      })

      after(function() {
        obj.transports.http.get = fn;
      })

      it('triggers reports command', function(done) {

        var called = false;

        obj.commands = {};
        obj.commands.run = function(command, target, opts) {
          if (command == 'get' && target == 'report') called = true;
        }

        plugin.load.call(obj);

        setTimeout(function() {
          called.should.be.true;
          done();
        }, 10)

      });

    })

  })

})

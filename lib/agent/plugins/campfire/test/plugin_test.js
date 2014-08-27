var should   = require('should'),
    sinon    = require('sinon'),
    Emitter  = require('events').EventEmitter;

var plugin   = require('..'),
    parser   = require('../parser'),
    Campfire = require('campfire').Campfire;

var common = require('./../../../common'),
    config = common.config,
    loader = require('../../../plugin');

describe('campfire-plugin', function() {

  var stub, stub2; // temporary holders
  var fake_credentials = { token: '123456', room_id: '483910', subdomain: 'krusty' };

  var fake_room = function(emitter) {
    // the emitter object lets us:
    // a) trigger messages to the listen() callback function (plugin.parse_message)
    // b) capture any calls made to the listeners's end() function as well as room.leave()
    return {
      name: 'Secret room',
      listen: function(listener) { 
        if (emitter) emitter.on('message', listener) 
        return { 
          end: function() { 
            emitter.emit('end', arguments) 
          } 
        }
      },
      speak: function(str) { },
      paste: function(str) { },
      leave: function(cb) { 
        emitter.emit('leave', arguments);
        if (cb) cb()
      }
    }
  }

  var load = function(opts, cb) {
    // stub the config.object that is wrapped by the loader
    var fn   = function(key, sub) { return sub ? opts[sub] : opts };
    var config_stub = sinon.stub(config, 'get', fn);

    loader.load('campfire', function(err) {
      config_stub.restore();
      cb(err);
    });
  }

  before(function() {
    common.logger.pause();
  })

  after(function() {
    common.logger.resume();
  })

  describe('load', function() {

    describe('with no credentials', function() {

      var opts = { token: null, room_id: null };

      it ('callbacks an error', function(done) {
        load(opts, function(err) {
          err.should.be.a.Error;
          done();
        })
      })
    })

    describe('with credentials', function() {

      var opts = fake_credentials;

      describe('with no connection', function() {

        before(function() {
          var err = new Error('No connection');
          err.code = 'EADDRINFO';
          var fn = function(cb) { return cb(err) };
          stub = sinon.stub(Campfire.prototype, 'me', fn);
        })

        it('does not callback an error', function(done) {
          load(opts, function(err) {
            should.not.exist(err);
            stub.restore();
            done();
          })
        })

      })

      describe('connected, but unauthorized', function() {

        before(function() {
          var fn = function(cb) { return cb(new Error('Invalid token.')) };
          stub = sinon.stub(Campfire.prototype, 'me', fn);
        })

        after(function() {
          stub.restore()
        })

        it('callbacks an error', function(done) {
          load(opts, function(err) {
            err.should.be.a.Error;
            done();
          })
        })

      })

      describe('connected, and authorized', function() {

        var emitter = new Emitter;

        before(function() {
          var data = { user: { id: 1234 } };
          var fn   = function(cb) { return cb(null, data) };
          stub = sinon.stub(Campfire.prototype, 'me', fn);

          var fn = function(id, cb) { cb(null, fake_room(emitter)) }
          stub2 = sinon.stub(Campfire.prototype, 'join', fn);
        })

        after(function() {
          stub.restore();
          stub2.restore();
        })

        it('does not callback an error', function(done) {
          load(opts, function(err) {
            should.not.exist(err);
            stub.restore();
            done();
          })
        })

        it('starts listening for messages', function(done) {

          var spy = sinon.spy(parser, 'call');
          emitter.emit('message', { body: 'Hello there' })

          process.nextTick(function() {
            spy.calledOnce.should.be.true;
            spy.args[0][1].body.should.equal('Hello there');
            spy.restore();
            done();
          })

        })

      })

    })

  })

  describe('unload', function() {

    describe('when not loaded', function() {

      it('callbacks no errors', function(done) {
        loader.unload('campfire', function(err) {
          should.not.exist(err);
          done()
        })
      })

    })

    describe('when loaded', function() {

      var opts = fake_credentials;

      describe('and not connected', function() {

        beforeEach(function(done) {
          var err = new Error('No connection');
          err.code = 'EADDRINFO';
          var fn = function(cb) { return cb(err) };
          stub = sinon.stub(Campfire.prototype, 'me', fn);

          load(opts, function(err) {
            should.not.exist(err);
            done();
          })
        })

        afterEach(function() {
          stub.restore();
        })

        it('callbacks no errors', function(done) {
          loader.unload('campfire', function(err) {
            should.not.exist(err);
            done()
          })
        })

        it('stops the reconnect timer', function(done) {
          var spy = sinon.spy(global, 'clearTimeout')

          loader.unload('campfire', function(err) {
            spy.calledOnce.should.be.true;
            spy.restore();
            done()
          })
        })

      })

      describe('and connected', function() {

        var emitter = new Emitter;

        beforeEach(function(done) {
          var data = { user: { id: 1234 } };
          var fn   = function(cb) { return cb(null, data) };
          stub = sinon.stub(Campfire.prototype, 'me', fn);

          var fn = function(id, cb) { cb(null, fake_room(emitter)) }
          stub2 = sinon.stub(Campfire.prototype, 'join', fn);

          load(opts, function(err) {
            should.not.exist(err);
            done();
          })
        })

        afterEach(function() {
          stub.restore();
          stub2.restore();
        })

        it('callbacks no errors', function(done) {
          loader.unload('campfire', function(err) {
            should.not.exist(err);
            done()
          })
        })

        it('leaves the room', function(done) {
          var called = false;
          emitter.on('leave', function() {  called = true })

          loader.unload('campfire', function(err) {
            called.should.be.true;
            done()
          })
        })

        it('stops listening for messages', function(done) {
          var called = false;
          emitter.on('end', function() {  called = true })

          loader.unload('campfire', function(err) {
            called.should.be.true;
            done()
          })
        })

      })

    })

  })

})
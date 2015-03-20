var assert = require("assert"),
    sinon  = require('sinon'),
    should = require('should'),
    api = require('../../api'),
    interval = require(".."),
    bus = require("../../bus"),
    hooks = require('../../../../hooks'),
    common = require('../../../../../common'),
    common_obj = {
      hooks: hooks,
      config: common.config,
      logger: common.logger
    };

describe('interval', function () {

  var setTimeout_spy = {},
      clearTimeout_spy = {},
      request_stub = {};

  var set_spies = function () {
    setTimeout_spy = sinon.spy(global, "setTimeout");
    clearTimeout_spy = sinon.spy(global, "clearTimeout");
  };

  var restore_spies = function () {
    setTimeout_spy.restore();
    clearTimeout_spy.restore();
  };

  var reset_spies = function () {
    setTimeout_spy.reset();
    clearTimeout_spy.reset();
  };

  var set_request_stub = function () {
    request_stub = sinon.stub(api.devices.get, 'commands', function (cb) {
      var err = new Error("Something wrong"),
          resp = {
            statusCode: 503
          };
      cb(err, resp);
    });
  };

  var restore_request_stub = function () {
    request_stub.restore();
  };

  var load_module = function (cb) {
    interval.load.call(common_obj, cb);
  };

  before(function () {
    set_spies();
  });

  after(function () {
    restore_spies();
  });

  describe('on load', function () {

    beforeEach(function () {
      interval.unload();
      reset_spies();
    });

    it('queue a request to be issues in 3 seconds', function () {

      load_module(function (err, emitter) {
        setTimeout_spy.calledOnce.should.equal(true);
        setTimeout_spy.args[0][1].should.equal(3000);
      });

    });

    it('sets the hooks', function () {

      load_module(function (err, emitter) {
        var hook_emitted = hooks.emit('connected');
        hook_emitted.should.equal(true);
      });

    });

    it('sets the bus', function () {

      load_module(function (err, emitter) {
        var bus_emitted = bus.emit('reachable');
        bus_emitted.should.equal(true);
      });

    });

  });

  describe('when reachable or unreachable is trigered', function () {

    beforeEach(function () {
      interval.unload();
      reset_spies();
    });

    it('dequeues the previous request', function () {

      load_module(function (err, emitter) {
        bus.emit("reachable");
        process.nextTick(function () {
          clearTimeout_spy.calledOnce.should.equal(true);
        });
      });

    });

  });

  describe('when device is reachable', function () {

    beforeEach(function () {
      interval.unload();
      reset_spies();
    });

    it('changes to slower interval', function () {

      load_module(function (err, emitter) {
        bus.emit("reachable");
        process.nextTick(function () {
          setTimeout_spy.calledTwice.should.equal(true);
          setTimeout_spy.args[1][1].should.equal(1200000);
        });
      });

    });

    it('dequeues the previous request', function () {

      load_module(function (err, emitter) {
        bus.emit("reachable");
        process.nextTick(function () {
          clearTimeout_spy.calledOnce.should.equal(true);
        });
      });

    });

  });

  describe('when device is unreachable', function () {

    beforeEach(function () {
      interval.unload();
      reset_spies();
    });

    it('changes to faster interval', function () {

      load_module(function (err, emitter) {
        bus.emit("unreachable");
        process.nextTick(function () {
          setTimeout_spy.calledTwice.should.equal(true);
          setTimeout_spy.args[1][1].should.equal(30000);
        });
      });

    });

    it('dequeues the previous request', function () {

      load_module(function (err, emitter) {
        bus.emit("unreachable");
        process.nextTick(function () {
          clearTimeout_spy.calledOnce.should.equal(true);
        });
      });

    });

    it('orders request to re-schedule', function () {

      set_request_stub();

      load_module(function (err, emitter) {
        bus.emit("unreachable");
      });

      setTimeout_spy.args[1][2].should.equal(true);

      restore_request_stub();

    });

    it('keeps scheduling requests', function () {

      var clock = sinon.useFakeTimers();

      set_request_stub();

      load_module(function (err, emitter) {
        bus.emit("unreachable");
      });

      // wait for 3 requests of 30 sec.
      clock.tick(90000);
      clock.restore();

      request_stub.callCount.should.equal(3);

      restore_request_stub();

    });

  });

  describe('on check', function() {

    before(function () {
      set_request_stub();
    });

    beforeEach(function () {
      request_stub.reset();
      interval.unload();
      reset_spies();
    });

    after(function() {
      restore_request_stub();
    });

    it('triggers a request', function(done) {

      load_module(function (err, emitter) {});
      interval.check();
      request_stub.calledOnce.should.equal(true);
      done();

    });

    it('does not order request to re-schedule', function(done) {

      load_module(function (err, emitter) {});
      interval.check();
      request_stub.args[0].length.should.equal(1);
      done();

    });

    it('does not queue a request', function(done) {

      var clock = sinon.useFakeTimers();

      load_module(function (err, emitter) {
        bus.emit("reachable");
      });

      interval.check();

      // wait for 2 requests of 20 min.
      clock.tick(2400000);
      clock.restore();

      // 1st request = interval.check()
      // 2nd request = 20 min. after load
      // 3rd request = 40 min. after load
      request_stub.callCount.should.equal(3);
      done();

    });

  });

  describe('on unload', function (){

    before(function () {
      interval.unload();
      reset_spies();
    });

    it('unloads the module', function () {

      load_module(function (err, emitter) {
        var hook_emitted = hooks.emit('connected');
        hook_emitted.should.equal(true);
      });

      interval.unload();

      process.nextTick(function () {
        var hook_emitted = hooks.emit('connected');
        hook_emitted.should.equal(false);
      });

    });

  });

});


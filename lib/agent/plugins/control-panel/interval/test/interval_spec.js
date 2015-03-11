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
      clearTimeout_spy = {};

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

    it('dequeues the request', function () {

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

  });

  describe('on check', function() {

    var api_stub = {};

    before(function () {
      interval.unload();
      api_stub = sinon.stub(api.devices.get, 'commands', function (cb) {
        return true;
      });
    });

    it('triggers a request', function(done) {

      load_module(function (err, emitter) {

        interval.check();
        api_stub.calledOnce.should.equal(true);
        done();

      });

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


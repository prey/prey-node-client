var assert = require("assert"),
    sinon  = require('sinon'),
    should = require('should'),
    api = require('../../api'),
    interval = require(".."),
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

  function set_spies () {
    setTimeout_spy = sinon.spy(global, "setTimeout");
    clearTimeout_spy = sinon.spy(global, "clearTimeout");
  };

  function restore_spies () {
    setTimeout_spy.restore();
    clearTimeout_spy.restore();
  };

  function reset_spies () {
    setTimeout_spy.reset();
    clearTimeout_spy.reset();
  };

  function set_request_stub () {
    request_stub = sinon.stub(api.devices.get, 'commands', function (cb) {
      var err = new Error("Something wrong"),
          resp = {
            statusCode: 503
          };
      cb(err, resp);
    });
  };

  function restore_request_stub () {
    request_stub.restore();
  };

  function load_module (cb) {
    interval.load.call(common_obj, cb);
  };

  before(function () {
    api.use( { try_proxy: ''} );
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

  });

  describe('on unload', function (){

    before(function () {
      interval.unload();
      reset_spies();
    });

    it('unloads the module', function () {

      load_module(function (err, emitter) {
      });

      interval.unload(function(unloaded) {
				unloaded.should.be.true;
			});

    });

  });

});


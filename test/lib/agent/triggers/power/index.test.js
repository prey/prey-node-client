'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const { EventEmitter } = require('events');

describe('lib/agent/triggers/power passes bypassCache through providers.get', () => {
  let mod;
  let providersStub;
  let power;
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    mod = rewire('../../../../../lib/agent/triggers/power');

    // Controllable power emitter handed back by os-triggers.watch.
    power = new EventEmitter();
    mod.__set__('triggers', {
      watch: (name, cb) => cb(null, power),
      unwatch: () => {},
    });

    providersStub = { get: sinon.stub() };
    mod.__set__('providers', providersStub);
    mod.__set__('status', { set_status: () => {} });
  });

  afterEach(() => sinon.restore());

  it('requests battery_status with { bypassCache: true } after a power event', (done) => {
    mod.start({}, (err) => {
      expect(err).to.be.null;

      power.emit('state_changed', {});
      clock.tick(2000); // the trigger waits 2s before reading battery status

      expect(providersStub.get.called).to.be.true;
      const [name, options] = providersStub.get.lastCall.args;
      expect(name).to.equal('battery_status');
      expect(options).to.deep.equal({ bypassCache: true });
      done();
    });
  });

  it('also bypasses the cache on the initial seed read', (done) => {
    mod.start({}, () => {
      // start() seeds `previous` via check_battery_status(true) synchronously.
      expect(providersStub.get.firstCall.args[0]).to.equal('battery_status');
      expect(providersStub.get.firstCall.args[1]).to.deep.equal({ bypassCache: true });
      done();
    });
  });
});

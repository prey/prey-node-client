'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('lib/agent/providers/indicators/index get_battery_status', () => {
  let mod;
  let osFunctionsStub;

  beforeEach(() => {
    // Fresh module each test so the module-level `battery_available` flag and the
    // injected `os_functions` start clean.
    mod = rewire('../../../../../lib/agent/providers/indicators/index');
    osFunctionsStub = { get_battery_status: sinon.stub() };
    mod.__set__('os_functions', osFunctionsStub);
  });

  afterEach(() => sinon.restore());

  it('invokes the callback exactly once and arms the circuit breaker on "No Instance(s) Available."', (done) => {
    const err = new Error('No Instance(s) Available.');
    osFunctionsStub.get_battery_status.callsFake((cb) => cb(err));

    const callback = sinon.stub();

    mod.get_battery_status(callback);

    // Give any stray second invocation a tick to (not) happen.
    setImmediate(() => {
      expect(callback.callCount).to.equal(1);
      // Circuit-breaker branch calls back with no arguments.
      expect(callback.firstCall.args).to.deep.equal([]);
      expect(mod.__get__('battery_available')).to.equal(false);
      done();
    });
  });

  it('passes through a normal error without arming the circuit breaker', (done) => {
    const err = new Error('some other failure');
    osFunctionsStub.get_battery_status.callsFake((cb) => cb(err));

    const callback = sinon.stub();

    mod.get_battery_status(callback);

    setImmediate(() => {
      expect(callback.callCount).to.equal(1);
      expect(callback.firstCall.args[0]).to.equal(err);
      expect(mod.__get__('battery_available')).to.equal(true);
      done();
    });
  });

  it('calls back once with data on success', (done) => {
    const data = { percentage_remaining: 80, state: 'discharging' };
    osFunctionsStub.get_battery_status.callsFake((cb) => cb(null, data));

    const callback = sinon.stub();

    mod.get_battery_status(callback);

    setImmediate(() => {
      expect(callback.callCount).to.equal(1);
      expect(callback.firstCall.args[0]).to.be.null;
      expect(callback.firstCall.args[1]).to.deep.equal(data);
      done();
    });
  });

  it('short-circuits with a single no-arg callback once the breaker is armed', (done) => {
    mod.__set__('battery_available', false);

    const callback = sinon.stub();

    mod.get_battery_status(callback);

    setImmediate(() => {
      expect(callback.callCount).to.equal(1);
      expect(callback.firstCall.args).to.deep.equal([]);
      // The underlying os function must not be touched when the breaker is open.
      expect(osFunctionsStub.get_battery_status.called).to.equal(false);
      done();
    });
  });
});

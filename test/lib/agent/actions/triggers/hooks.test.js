/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const rewire = require('rewire');
const { EventEmitter } = require('events');

// Minimal stand-in for lib/agent/hooks: an EventEmitter with the same remove() semantics
// (no function => removeAllListeners), so a regression to hooks.remove(event) is visible.
const makeHooks = () => {
  const emitter = new EventEmitter();
  emitter.remove = (event, fn) => {
    if (fn) emitter.removeListener(event, fn);
    else if (event) emitter.removeAllListeners(event);
  };
  emitter.trigger = emitter.emit.bind(emitter);
  return emitter;
};

describe('actions/triggers - automation hook listeners', () => {
  let triggersModule;
  let hooks;
  let setUpHooks;
  let cancelHooks;

  beforeEach(() => {
    triggersModule = rewire('../../../../../lib/agent/actions/triggers');
    hooks = makeHooks();
    triggersModule.__set__('hooks', hooks);
    triggersModule.__set__('eventTriggers', {
      connected: [{ action: { command: 'start', target: 'alarm' } }],
      mac_address_changed: [{ action: { command: 'start', target: 'alarm' } }],
      'device_unseen-5': [{ action: { command: 'start', target: 'alarm' } }],
    });
    setUpHooks = triggersModule.__get__('setUpHooks');
    cancelHooks = triggersModule.__get__('cancelHooks');
  });

  it('cancelHooks keeps listeners registered by other modules', () => {
    const locationConnected = () => {};
    const locationMac = () => {};
    hooks.on('connected', locationConnected);
    hooks.on('mac_address_changed', locationMac);

    setUpHooks();
    expect(hooks.listenerCount('connected')).to.equal(2);

    cancelHooks();

    expect(hooks.listeners('connected')).to.deep.equal([locationConnected]);
    expect(hooks.listeners('mac_address_changed')).to.deep.equal([locationMac]);
  });

  it('removes automation listeners registered under a composite event key', () => {
    setUpHooks();
    expect(hooks.listenerCount('device_unseen')).to.equal(1);

    cancelHooks();

    expect(hooks.listenerCount('device_unseen')).to.equal(0);
  });

  it('does not pile up automation listeners across refreshes', () => {
    for (let i = 0; i < 3; i += 1) {
      cancelHooks();
      setUpHooks();
    }

    expect(hooks.listenerCount('connected')).to.equal(1);
    expect(hooks.listenerCount('mac_address_changed')).to.equal(1);
    expect(hooks.listenerCount('device_unseen')).to.equal(1);
  });

  it('cancel_all (the refresh path) goes through cancelHooks without touching foreign listeners', () => {
    const foreign = () => {};
    hooks.on('connected', foreign);
    setUpHooks();

    triggersModule.cancel_all();

    expect(hooks.listeners('connected')).to.deep.equal([foreign]);
  });
});

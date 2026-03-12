/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
// test/lib/agent/permissions/windows.test.js
const sinon = require('sinon');
const chai = require('chai');

const { expect } = chai;

describe('OWCA_TDD_getLocationPermission_Windows_hook_shape', () => {
  let hooks;
  let permissions;
  let nameArray;

  beforeEach(() => {
    // Clear module cache to get fresh modules
    delete require.cache[require.resolve('../../../../lib/agent/hooks')];
    delete require.cache[require.resolve('../../../../lib/agent/permissions/windows')];
    delete require.cache[require.resolve('../../../../lib/agent/socket/messages')];

    hooks = require('../../../../lib/agent/hooks');
    permissions = require('../../../../lib/agent/permissions/windows');
    nameArray = require('../../../../lib/agent/socket/messages').nameArray;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should emit hook with correct structure [nameArray[1], "Allow", callback]', (done) => {
    const mockCb = sinon.spy();
    let hookTriggered = false;

    // Listen to the hook
    const hookListener = (data) => {
      hookTriggered = true;
      expect(data[0]).to.equal(nameArray[1]);
      expect(data[1]).to.equal('Allow');
      expect(data[2]).to.equal(mockCb);
      hooks.remove(nameArray[1], hookListener);
      done();
    };

    hooks.on(nameArray[1], hookListener);
    permissions.getLocationPermission(mockCb);

    // Verify hook was triggered
    setTimeout(() => {
      if (!hookTriggered) {
        hooks.remove(nameArray[1], hookListener);
        done(new Error('Hook was not triggered'));
      }
    }, 100);
  });

  it('should preserve the original callback as data[2]', (done) => {
    const mockCb = sinon.spy();

    const hookListener = (data) => {
      expect(typeof data[2]).to.equal('function');
      expect(data[2]).to.equal(mockCb);
      hooks.remove(nameArray[1], hookListener);
      done();
    };

    hooks.on(nameArray[1], hookListener);
    permissions.getLocationPermission(mockCb);
  });

  it('should emit hook with empty callback if none provided', (done) => {
    const hookListener = (data) => {
      expect(typeof data[2]).to.equal('function');
      expect(data[0]).to.equal(nameArray[1]);
      expect(data[1]).to.equal('Allow');
      hooks.remove(nameArray[1], hookListener);
      done();
    };

    hooks.on(nameArray[1], hookListener);
    permissions.getLocationPermission(); // without callback
  });

  it('should emit hook synchronously every time', (done) => {
    const spy = sinon.spy();

    hooks.once(nameArray[1], spy);
    permissions.getLocationPermission(() => {});

    // Should be called immediately
    expect(spy.called).to.be.true;
    done();
  });

  it('should work with reactToCheckLocationPerms listener structure', (done) => {
    const mockCb = sinon.spy();

    const hookListener = (data) => {
      // Verify structure expected by reactToCheckLocationPerms
      expect(data[0]).to.equal(nameArray[1]);
      expect(data[1]).to.equal('Allow');
      expect(data[1].localeCompare('Allow')).to.equal(0); // This is what listeners checks
      expect(typeof data[2]).to.equal('function');
      hooks.remove(nameArray[1], hookListener);
      done();
    };

    hooks.on(nameArray[1], hookListener);
    permissions.getLocationPermission(mockCb);
  });
});

/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
// test/lib/agent/permissions/windows.test.js
const sinon = require('sinon');
const chai = require('chai');
const system = require('../../../../lib/system');

const { expect } = chai;

describe('OWCA_TDD_getLocationPermission_Windows_hook_shape', () => {
  let hooks;
  let permissions;
  let nameArray;
  let spawnAsAdminUserStub;

  beforeEach(() => {
    // Clear module cache to get fresh modules
    delete require.cache[require.resolve('../../../../lib/agent/hooks')];
    delete require.cache[require.resolve('../../../../lib/agent/permissions/windows')];
    delete require.cache[require.resolve('../../../../lib/agent/socket/messages')];

    hooks = require('../../../../lib/agent/hooks');
    permissions = require('../../../../lib/agent/permissions/windows');
    nameArray = require('../../../../lib/agent/socket/messages').nameArray;

    // Avoid invoking real OS-level command execution in unit tests.
    spawnAsAdminUserStub = sinon.stub(system, 'spawn_as_admin_user').callsFake((nodeBin, data, cb) => {
      const permissionWindowsLocation = (action, payload, callback) => {
        callback(null, { code: 0, message: 'Allow' });
      };
      cb(null, permissionWindowsLocation);
    });
  });

  afterEach(() => {
    hooks.remove(nameArray[1]);
    spawnAsAdminUserStub.restore();
    sinon.restore();
  });

  it('should emit hook with structure [true, "Allow", callback]', (done) => {
    const mockCb = sinon.spy();

    // Listen to the hook
    const hookListener = (data) => {
      expect(data[0]).to.equal(true);
      expect(data[1]).to.equal('Allow');
      expect(data[2]).to.equal(mockCb);
      hooks.remove(nameArray[1], hookListener);
      done();
    };

    hooks.on(nameArray[1], hookListener);
    permissions.getLocationPermission(mockCb);
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
      expect(data[0]).to.equal(true);
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
      expect(data[0]).to.equal(true);
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

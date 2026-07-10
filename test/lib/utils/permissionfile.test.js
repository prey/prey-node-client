/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
// test/lib/utils/permissionfile.test.js
const sinon = require('sinon');
const chai = require('chai');

const { expect } = chai;
const storage = require('../../../lib/agent/utils/storage');
const permissionFile = require('../../../lib/utils/permissionfile');

describe('permissionfile', () => {
  const savedPermissionData = { ...permissionFile.permissionData };

  afterEach(() => {
    permissionFile.permissionData.nativeLocation = savedPermissionData.nativeLocation;
    permissionFile.permissionData.wifiLocation = savedPermissionData.wifiLocation;
  });

  describe('getData', () => {
    it('should return a string unchanged', () => {
      permissionFile.permissionData.nativeLocation = 'true';
      expect(permissionFile.getData('nativeLocation')).to.equal('true');
    });

    // Regression: a boolean can end up stored here (e.g. from the mac native
    // helper's socket payload) either before this fix shipped, or from any
    // future caller that forgets to stringify. getData must self-heal that on
    // every read so consumers relying on .localeCompare() never crash.
    it('should coerce a legacy boolean value to a string', () => {
      permissionFile.permissionData.nativeLocation = true;
      expect(permissionFile.getData('nativeLocation')).to.equal('true');

      permissionFile.permissionData.wifiLocation = false;
      expect(permissionFile.getData('wifiLocation')).to.equal('false');
    });
  });

  describe('setData', () => {
    let storageStub;

    beforeEach(() => {
      storageStub = sinon.stub(storage, 'do').callsFake((method, params, cb) => cb());
    });

    afterEach(() => {
      storageStub.restore();
    });

    it('should persist a boolean value as a normalized string', (done) => {
      permissionFile.setData('nativeLocation', true, () => {
        expect(permissionFile.permissionData.nativeLocation).to.equal('true');
        done();
      });
    });
  });
});

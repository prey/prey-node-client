/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
const chai = require('chai');
const rewire = require('rewire');

const { expect } = chai;

describe('request_permission action', () => {
  let requestPermission;
  let socketStub;
  let strategiesStub;
  let geoIndexStub;
  let requestNativePermission;

  beforeEach(() => {
    requestPermission = rewire('../../../../../lib/agent/actions/request_permission');
    socketStub = { writeMessage: sinon.stub().callsFake((_msg, cb) => cb()) };
    strategiesStub = { askLocationNativePermission: sinon.stub() };
    geoIndexStub = { getLocationRequest: sinon.stub() };

    requestPermission.__set__('socket', socketStub);
    requestPermission.__set__('strategies', strategiesStub);
    requestPermission.__set__('geoIndex', geoIndexStub);
    requestPermission.__set__('osName', 'mac');

    requestNativePermission = requestPermission.__get__('requestNativePermission');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should return an error immediately when not running on mac', (done) => {
    requestPermission.__set__('osName', 'windows');
    requestNativePermission((err) => {
      expect(err).to.be.an.instanceOf(Error);
      done();
    });
  });

  // Regression: permissionFile's SQLite-backed 'nativeLocation' can already hold a
  // legacy raw boolean on affected machines (see lib/utils/permissionfile.js). Uses
  // the real permissionFile singleton (not a stub) to prove getData()'s normalization
  // protects this consumer, which calls .localeCompare() with no type guard.
  it('should not throw and should skip re-requesting when permissionFile holds a legacy boolean', (done) => {
    // eslint-disable-next-line global-require
    const realPermissionFile = require('../../../../../lib/utils/permissionfile');
    requestPermission.__set__('permissionFile', realPermissionFile);
    const saved = realPermissionFile.permissionData.nativeLocation;
    realPermissionFile.permissionData.nativeLocation = true;

    expect(() => requestNativePermission((err) => {
      realPermissionFile.permissionData.nativeLocation = saved;
      expect(err).to.be.null;
      expect(strategiesStub.askLocationNativePermission.called).to.be.false;
      done();
    })).to.not.throw();
  });
});

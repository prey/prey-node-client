/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
const { expect } = require('chai');
const rewire = require('rewire');
const { nameArray } = require('../../../../../lib/agent/socket/messages');

describe('Geo Darwin Native Provider', () => {
  let darwinGeo;
  let socketStub;
  let configutilStub;
  let systemStub;

  const getSocketPayload = () => ({
    result: {
      messages: [
        { message: {} },
        { message: { lat: 12.34, lng: -56.78, accuracy: '10.1234567' } },
      ],
    },
  });

  beforeEach(() => {
    darwinGeo = rewire('../../../../../lib/agent/providers/geo/darwin/index');

    socketStub = { writeMessage: sinon.stub() };
    configutilStub = { getDataDbKey: sinon.stub() };
    systemStub = { get_os_version: sinon.stub() };

    darwinGeo.__set__('socket', socketStub);
    darwinGeo.__set__('configutil', configutilStub);
    darwinGeo.__set__('system', systemStub);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('parseResponse', () => {
    it('should parse socket response and normalize accuracy precision', (done) => {
      const parseResponse = darwinGeo.__get__('parseResponse');

      parseResponse(getSocketPayload(), (err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal({ lat: 12.34, lng: -56.78, accuracy: '10.123457' });
        done();
      });
    });

    it('should return error when response payload is malformed', (done) => {
      const parseResponse = darwinGeo.__get__('parseResponse');

      parseResponse({ result: {} }, (err) => {
        expect(err).to.be.an.instanceOf(Error);
        done();
      });
    });
  });

  describe('get_location', () => {
    it('should return not supported error for versions below 10.6.0', (done) => {
      systemStub.get_os_version.callsFake((cb) => cb(null, '10.5.0'));

      darwinGeo.get_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Not yet supported');
        done();
      });
    });

    it('should return skipped permission error when location is skipped', (done) => {
      systemStub.get_os_version.callsFake((cb) => cb(null, '10.6.0'));
      configutilStub.getDataDbKey.callsFake((_key, cb) => cb(null, [{ value: JSON.stringify({ location: 'true' }) }]));

      darwinGeo.get_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Location permission skipped');
        expect(socketStub.writeMessage.called).to.be.false;
        done();
      });
    });

    it('should fallback to socket path when skippedPermissions query fails', (done) => {
      systemStub.get_os_version.callsFake((cb) => cb(null, '11.0.0'));
      configutilStub.getDataDbKey.callsFake((_key, cb) => cb(new Error('db failure')));
      socketStub.writeMessage.callsFake((_name, cb) => cb(null, getSocketPayload()));

      darwinGeo.get_location((err, res) => {
        expect(err).to.be.null;
        expect(res.lat).to.equal(12.34);
        expect(res.lng).to.equal(-56.78);
        expect(socketStub.writeMessage.calledOnce).to.be.true;
        expect(socketStub.writeMessage.firstCall.args[0]).to.equal(nameArray[0]);
        done();
      });
    });

    it('should fallback to socket path when skippedPermissions data is invalid JSON', (done) => {
      systemStub.get_os_version.callsFake((cb) => cb(null, '12.0.0'));
      configutilStub.getDataDbKey.callsFake((_key, cb) => cb(null, [{ value: '{invalid_json' }]));
      socketStub.writeMessage.callsFake((_name, cb) => cb(null, getSocketPayload()));

      darwinGeo.get_location((err, res) => {
        expect(err).to.be.null;
        expect(res).to.include({ lat: 12.34, lng: -56.78 });
        expect(socketStub.writeMessage.calledOnce).to.be.true;
        done();
      });
    });

    it('should fallback to getLocationOld when socket fails', (done) => {
      const getLocationOldStub = sinon.stub().callsFake((cb) => cb(null, { lat: 1, lng: 2 }));

      systemStub.get_os_version.callsFake((cb) => cb(null, '13.0.0'));
      configutilStub.getDataDbKey.callsFake((_key, cb) => cb(null, [{ value: JSON.stringify({ location: 'false' }) }]));
      socketStub.writeMessage.callsFake((_name, cb) => cb(new Error('socket failed')));
      darwinGeo.__set__('getLocationOld', getLocationOldStub);

      darwinGeo.get_location((err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal({ lat: 1, lng: 2 });
        expect(getLocationOldStub.calledOnce).to.be.true;
        done();
      });
    });
  });

  describe('askLocationNativePermission', () => {
    it('should call socket with 31000 timeout and return data', (done) => {
      const payload = { ok: true };
      socketStub.writeMessage.callsFake((_name, cb) => cb(null, payload));

      darwinGeo.askLocationNativePermission((err, data) => {
        expect(err).to.be.null;
        expect(data).to.deep.equal(payload);
        expect(socketStub.writeMessage.calledOnce).to.be.true;
        expect(socketStub.writeMessage.firstCall.args[0]).to.equal(nameArray[0]);
        expect(socketStub.writeMessage.firstCall.args[2]).to.equal(31000);
        done();
      });
    });

    it('should propagate socket errors', (done) => {
      socketStub.writeMessage.callsFake((_name, cb) => cb(new Error('permission request failed')));

      darwinGeo.askLocationNativePermission((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('permission request failed');
        done();
      });
    });
  });
});

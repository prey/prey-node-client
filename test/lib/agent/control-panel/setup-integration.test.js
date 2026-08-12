/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

const api = require('../../../../lib/agent/control-panel/api');
const storage = require('../../../../lib/agent/utils/storage');
const providers = require('../../../../lib/agent/providers');
const secure = require('../../../../lib/agent/control-panel/secure');
const storeIdentification = require('../../../../lib/agent/control-panel/store-identification');

describe('setup.start — linkDevice call path integration', () => {
  const DEVICE_KEY = 'test-device-key-xyz';

  let setup;
  let mockConfig;
  let mockCommon;

  beforeEach(() => {
    mockConfig = {
      all: sinon.stub().returns({ 'control-panel.api_key': '', 'control-panel.device_key': '' }),
      setData: sinon.stub().callsFake((_key, _val, cb) => { if (typeof cb === 'function') cb(null); }),
    };

    setup = rewire('../../../../lib/agent/control-panel/setup');
    setup.__set__('storeIdentification', storeIdentification);
    setup.__set__('config', mockConfig);

    sinon.stub(api.keys, 'set').callsFake((_keys, cb) => cb(null));
    sinon.stub(api.keys, 'present').returns(false);
    sinon.stub(api.devices, 'link').callsFake((_data, cb) => cb(null, DEVICE_KEY));

    sinon.stub(storage, 'do').callsFake((op, _opts, cb) => {
      if (op === 'query')  return cb(null, []);
      if (op === 'set')    return cb(null);
      if (op === 'del')    return cb(null);
      if (op === 'update') return cb(null);
      cb(null);
    });

    sinon.stub(providers, 'get').callsFake((_name, cb) => {
      cb(null, { firmware_info: { device_type: 'Laptop', model_name: 'TestModel', vendor_name: 'TestCo' } });
    });

    sinon.stub(secure, 'notify_linked').returns(undefined);
    sinon.stub(storeIdentification, 'save').callsFake((_key, _payload, cb) => { if (typeof cb === 'function') cb(null); });

    mockCommon = {
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
      system: {
        get_os_name:     (cb) => cb(null, 'linux'),
        get_os_version:  (cb) => cb(null, '22.04'),
        get_device_name: () => 'test-host',
      },
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('calls storeIdentification.save with the device key and full payload on success', (done) => {
    setup.start(mockCommon, (err) => {
      expect(err).to.be.null;
      expect(storeIdentification.save.calledOnce).to.be.true;

      const [savedKey, savedPayload] = storeIdentification.save.firstCall.args;
      expect(savedKey).to.equal(DEVICE_KEY);
      expect(savedPayload).to.be.an('object');
      expect(savedPayload.name).to.equal('test-host');
      expect(savedPayload.os).to.equal('linux');
      expect(savedPayload.os_version).to.equal('22.04');
      expect(savedPayload).to.have.property('specs');
      done();
    });
  });

  it('does NOT call storeIdentification.save when api.devices.link returns an error', (done) => {
    api.devices.link.restore();
    sinon.stub(api.devices, 'link').callsFake((_data, cb) => cb(new Error('linking failed'), null));

    setup.start(mockCommon, (err) => {
      expect(err).to.be.instanceOf(Error);
      expect(storeIdentification.save.called).to.be.false;
      done();
    });
  });

  it('calls config.setData to persist the device key after storeIdentification succeeds', (done) => {
    setup.start(mockCommon, (err) => {
      expect(err).to.be.null;
      const setDataCalls = mockConfig.setData.getCalls().filter((c) => c.args[0] === 'control-panel.device_key');
      expect(setDataCalls.length).to.be.at.least(1);
      expect(setDataCalls[0].args[1]).to.equal(DEVICE_KEY);
      done();
    });
  });
});

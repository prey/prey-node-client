/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
// test/lib/conf/account.test.js
const sinon = require('sinon');
const { expect } = require('chai');
const keys = require('../../../lib/conf/shared/keys');
const panel = require('../../../lib/conf/shared/panel');
const account = require('../../../lib/conf/account');

describe('accounts conf module', () => {
  describe('authorize', () => {
    it('should call shared.panel.authorize with the correct parameters', (done) => {
      const values = {
        '-a': 'api_key',
        '-d': 'device_key',
        '-e': 'email',
        '-p': 'password',
      };
      const cb = sinon.stub();
      const sharedPanelAuthorizeStub = sinon.stub(panel, 'authorize');
      const accountSetApiKeyAndDeviceKeyRegister = sinon.stub(account, 'setApiKeyAndDeviceKeyRegister');
      const accountSetApiKeyAndRegister = sinon.stub(account, 'setApiKeyAndRegister');
      sharedPanelAuthorizeStub.callsFake((opts, callback) => {
        callback(null, 'key');
      });
      accountSetApiKeyAndDeviceKeyRegister.callsFake((opts, callback) => {
        callback(null);
      });

      account.authorize(values, cb);

      expect(sharedPanelAuthorizeStub.calledWith({
        username: 'email',
        password: 'password',
      })).to.be.true;

      sharedPanelAuthorizeStub.restore();
      accountSetApiKeyAndDeviceKeyRegister.restore();
      accountSetApiKeyAndRegister.restore();
      sinon.restore();
      done();
    });

    it('should call setApiKeyAndDeviceKeyRegister if a device_key is provided', (done) => {
      const values = {
        '-a': 'api_key',
        '-d': 'device_key',
      };
      const cb = sinon.stub();
      const sharedPanelAuthorizeStub = sinon.stub(panel, 'authorize');
      const accountSetApiKeyAndDeviceKeyRegister = sinon.stub(account, 'setApiKeyAndDeviceKeyRegister');
      sharedPanelAuthorizeStub.callsFake((opts, callback) => {
        callback(null, 'key');
      });
      accountSetApiKeyAndDeviceKeyRegister.callsFake((opts, callback) => {
        callback(null);
      });

      account.authorize(values, cb);

      expect(accountSetApiKeyAndDeviceKeyRegister.calledWithMatch({
        api_key: 'api_key',
        device_key: 'device_key',
      })).to.be.true;

      sharedPanelAuthorizeStub.restore();
      accountSetApiKeyAndDeviceKeyRegister.restore();
      done();
    });

    it('should call setApiKeyAndRegister if no device_key is provided', (done) => {
      const values = {
        '-a': 'api_key',
        '-e': 'email',
        '-p': 'password',
      };
      const cb = sinon.stub();
      const sharedPanelAuthorizeStub = sinon.stub(panel, 'authorize');
      const setApiKeyAndRegisterStub = sinon.stub(account, 'setApiKeyAndRegister');
      sharedPanelAuthorizeStub.callsFake((opts, callback) => {
        callback(null, 'key');
      });
      setApiKeyAndRegisterStub.callsFake((key, callback) => {
        callback(null);
      });

      account.authorize(values, cb);

      expect(setApiKeyAndRegisterStub.calledWith('key')).to.be.true;

      setApiKeyAndRegisterStub.restore();
      sharedPanelAuthorizeStub.restore();
      done();
    });

    it('should return an error if no password is provided', (done) => {
      const values = {
        '-a': 'api_key',
        '-e': 'email',
      };
      const cb = sinon.stub();

      account.authorize(values, cb);

      expect(cb.calledWith(sinon.match.instanceOf(Error))).to.be.true;

      done();
    });
  });

  describe('setApiKeyAndDeviceKeyRegister module', () => {
    let sharedKeysStub;
    let sharedPanelVerifyKeysStub;

    afterEach(() => {
      sharedKeysStub.restore();
      sharedPanelVerifyKeysStub.restore();
    });

    it('debería llamar a set_api_device_key con los parámetros correctos', (done) => {
      const keysData = { api_key: 'api_key', device_key: 'device_key' };
      sharedKeysStub = sinon.stub(keys, 'set_api_device_key').callsFake((key, cb) => {
        cb(null);
      });
      sharedPanelVerifyKeysStub = sinon.stub(panel, 'verify_keys').callsFake((key, cb) => {
        cb(null);
      });
      account.setApiKeyAndDeviceKeyRegister(keysData, () => {
        expect(sharedKeysStub.calledWithMatch({ api: 'api_key', device: 'device_key' })).to.be.true;
        expect(sharedPanelVerifyKeysStub.calledWithMatch({ api: 'api_key', device: 'device_key' })).to.be.true;
        done();
      });
    });

    it('debería llamar al callback con un error si set_api_device_key falla', (done) => {
      const keysData = { api_key: 'api_key', device_key: 'device_key' };
      const cb = sinon.spy();
      const error = new Error('Error de prueba');
      sharedKeysStub = sinon.stub(keys, 'set_api_device_key').callsFake((key, cbz) => {
        cbz(null);
      });
      sharedPanelVerifyKeysStub = sinon.stub(panel, 'verify_keys').callsFake((key, cbz) => {
        cbz(null);
      });
      sharedKeysStub.callsFake((opts, callback) => {
        callback(error);
      });
      account.setApiKeyAndDeviceKeyRegister(keysData, cb);
      expect(cb.calledWith(error)).to.be.true;
      done();
    });

    it('debería llamar al callback con un error si verify_keys falla', (done) => {
      const keysData = { api_key: 'api_key', device_key: 'device_key' };
      const cb = sinon.spy();
      const error = new Error('Error de prueba');
      sharedKeysStub = sinon.stub(keys, 'set_api_device_key').callsFake((key, cbz) => {
        cbz(error);
      });
      account.setApiKeyAndDeviceKeyRegister(keysData, cb);
      expect(cb.calledWith(error)).to.be.true;
      done();
    });

    it('debería llamar al callback sin errores si todo sale bien', (done) => {
      const keysData = { api_key: 'api_key', device_key: 'device_key' };
      sharedKeysStub = sinon.stub(keys, 'set_api_device_key').callsFake((key, cbz) => {
        cbz(null);
      });
      sharedPanelVerifyKeysStub = sinon.stub(panel, 'verify_keys').callsFake((key, cbz) => {
        cbz(null);
      });
      account.setApiKeyAndDeviceKeyRegister(keysData, () => {
        done();
      });
    });
  });

  describe('setApiKeyAndRegister module', () => {
    let sharedKeysStub;
    let sharedPanelLinkStub;

    beforeEach(() => {
      sharedKeysStub = sinon.stub(keys, 'set_api_key');
      sharedPanelLinkStub = sinon.stub(panel, 'link');
    });

    afterEach(() => {
      sharedKeysStub.restore();
      sharedPanelLinkStub.restore();
    });

    it('debería llamar a set_api_key con el API key proporcionado', (done) => {
      const apiKey = 'api_key';
      const cb = sinon.spy();

      account.setApiKeyAndRegister(apiKey, cb);

      expect(sharedKeysStub.calledWith(apiKey)).to.be.true;

      done();
    });

    it('debería llamar a link después de set_api_key', (done) => {
      const apiKey = 'api_key';
      const cb = sinon.spy();

      sharedKeysStub.callsFake((key, callback) => {
        callback(null);
      });

      account.setApiKeyAndRegister(apiKey, cb);

      expect(sharedPanelLinkStub.called).to.be.true;

      done();
    });

    it('debería llamar al callback con un error si set_api_key falla', (done) => {
      const apiKey = 'api_key';
      const cb = sinon.spy();
      const error = new Error('Error de prueba');

      sharedKeysStub.callsFake((key, callback) => {
        callback(error);
      });

      account.setApiKeyAndRegister(apiKey, cb);

      expect(cb.calledWith(error)).to.be.true;

      done();
    });

    it('debería llamar al callback con un error si link falla', (done) => {
      const apiKey = 'api_key';
      const cb = sinon.spy();
      const error = new Error('Error de prueba');

      sharedKeysStub.callsFake((key, callback) => {
        callback(null);
      });

      sharedPanelLinkStub.callsFake((callback) => {
        callback(error);
      });

      account.setApiKeyAndRegister(apiKey, cb);

      expect(cb.calledWithMatch(error)).to.be.true;

      done();
    });

    it('debería llamar al callback sin errores si todo sale bien', (done) => {
      const apiKey = 'api_key';

      sharedKeysStub.callsFake((key, callback) => {
        callback(null);
      });

      sharedPanelLinkStub.callsFake((callback) => {
        callback(null);
      });

      account.setApiKeyAndRegister(apiKey, () => {
        done();
      });
    });
  });
});

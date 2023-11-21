// eslint-disable-next-line no-unused-vars
const sinon = require('sinon');
const { join } = require('path');
// eslint-disable-next-line no-unused-vars
const should = require('should');
const preyConfJs = require('../../lib/agent/utils/prey-configuration/preyconf.js');

describe('Prey Conf file', () => {
  beforeEach(() => {
  });

  afterEach(() => {

  });
  describe('startVerifyPreyConf', () => {
    it('should verify default prey.conf - Good structure, but no api key or device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_default.conf');
      const dataVerifiedPreyConf = preyConfJs.startVerifyPreyConf();
      should(dataVerifiedPreyConf).have.property('constitution', false);
      should(dataVerifiedPreyConf).have.property('apiKeyValue', false);
      should(dataVerifiedPreyConf).have.property('deviceKeyValue', false);
      done();
    });

    it('should verify prey.conf - Good structure, api key and device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_apikey_devicekey.conf');
      const dataVerifiedPreyConf = preyConfJs.startVerifyPreyConf();
      should(dataVerifiedPreyConf).have.property('constitution', true);
      should(dataVerifiedPreyConf).have.property('apiKeyValue', true);
      should(dataVerifiedPreyConf).have.property('deviceKeyValue', true);
      done();
    });

    it('should verify prey.conf - no structure', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_noformat.conf');
      const dataVerifiedPreyConf = preyConfJs.startVerifyPreyConf();
      should(dataVerifiedPreyConf).have.property('constitution', false);
      should(dataVerifiedPreyConf).have.property('apiKeyValue', false);
      should(dataVerifiedPreyConf).have.property('deviceKeyValue', false);
      done();
    });

    it('should verify prey.conf - Good structure, no api key and device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_noapikey_devicekey.conf');
      const dataVerifiedPreyConf = preyConfJs.startVerifyPreyConf();
      should(dataVerifiedPreyConf).have.property('constitution', false);
      should(dataVerifiedPreyConf).have.property('apiKeyValue', false);
      should(dataVerifiedPreyConf).have.property('deviceKeyValue', false);
      done();
    });

    it('should verify prey.conf - Good structure, api key and no device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_apikey_nodevicekey.conf');
      const dataVerifiedPreyConf = preyConfJs.startVerifyPreyConf();
      should(dataVerifiedPreyConf).have.property('constitution', false);
      should(dataVerifiedPreyConf).have.property('apiKeyValue', true);
      should(dataVerifiedPreyConf).have.property('deviceKeyValue', false);
      done();
    });

    it('should verify prey.conf - Bad structure', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_bad_format.conf');
      const dataVerifiedPreyConf = preyConfJs.startVerifyPreyConf();
      should(dataVerifiedPreyConf).have.property('constitution', false);
      should(dataVerifiedPreyConf).have.property('apiKeyValue', true);
      should(dataVerifiedPreyConf).have.property('deviceKeyValue', false);
      done();
    });

    it('should verify prey.conf - No host', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_nohost.conf');
      const dataVerifiedPreyConf = preyConfJs.startVerifyPreyConf();
      should(dataVerifiedPreyConf).have.property('constitution', false);
      should(dataVerifiedPreyConf).have.property('apiKeyValue', false);
      should(dataVerifiedPreyConf).have.property('deviceKeyValue', false);
      done();
    });

    it('should verify prey.conf - No protocol', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_noprotocol.conf');
      const dataVerifiedPreyConf = preyConfJs.startVerifyPreyConf();
      should(dataVerifiedPreyConf).have.property('constitution', false);
      should(dataVerifiedPreyConf).have.property('apiKeyValue', false);
      should(dataVerifiedPreyConf).have.property('deviceKeyValue', false);
      done();
    });
  });

  describe('trySaveData', () => {
    it('should try to save default prey.conf - Good structure, but no api key or device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_default.conf');
      const dataToSave = preyConfJs.trySaveData();
      console.log(dataToSave);
      done();
    });

    it('should verify default prey.conf - Good structure, but no api key or device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_default.conf');
      const dataToSave = preyConfJs.trySaveData();
      console.log(dataToSave);
      done();
    });

    it('should verify prey.conf - Good structure, api key and device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_apikey_devicekey.conf');
      const dataToSave = preyConfJs.trySaveData();
      console.log(dataToSave);
      done();
    });

    it('should verify prey.conf - no structure', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_noformat.conf');
      const dataToSave = preyConfJs.trySaveData();
      console.log(dataToSave);
      done();
    });

    it('should verify prey.conf - Good structure, no api key and device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_noapikey_devicekey.conf');
      const dataToSave = preyConfJs.trySaveData();
      console.log(dataToSave);
      done();
    });

    it('should verify prey.conf - Good structure, api key and no device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_apikey_nodevicekey.conf');
      const dataToSave = preyConfJs.trySaveData();
      console.log(dataToSave);
      done();
    });

    it('should verify prey.conf - Bad structure', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_bad_format.conf');
      const dataToSave = preyConfJs.trySaveData();
      console.log(dataToSave);
      done();
    });

    it('should verify prey.conf - No host', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_nohost.conf');
      const dataToSave = preyConfJs.trySaveData();
      console.log(dataToSave);
      done();
    });

    it('should verify prey.conf - No protocol', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_noprotocol.conf');
      const dataToSave = preyConfJs.trySaveData();
      console.log(dataToSave);
      done();
    });
  });
});

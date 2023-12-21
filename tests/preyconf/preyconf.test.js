// eslint-disable-next-line no-unused-vars
const sinon = require('sinon');
const { join } = require('path');
// eslint-disable-next-line no-unused-vars
const should = require('should');
const preyConfJs = require('../../lib/agent/utils/prey-configuration/preyconf');
const { databaseData } = require('./utils/dummydata');

describe('Prey Conf file', () => {
  beforeEach(() => {
  });

  afterEach(() => {

  });
  describe('verifyExistingData', () => {
    it('Existing data with api_key and device_key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_default.conf');
      const dataVerifiedPreyConf = preyConfJs.verifyPreyConfData();
      preyConfJs.verifyExistingData(
        dataVerifiedPreyConf,
        { 'control-panel.api_key': 'x', 'control-panel.device_key': 'x' },
        (verified) => {
          sinon.assert.match(verified, true);
          done();
        },
      );
    });

    it('Existing data with only api_key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_default.conf');
      const dataVerifiedPreyConf = preyConfJs.verifyPreyConfData();
      preyConfJs.verifyExistingData(
        dataVerifiedPreyConf,
        { 'control-panel.api_key': 'x' },
        (verified) => {
          sinon.assert.match(verified, false);
          done();
        },
      );
    });

    it('Existing data without format', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_default.conf');
      const dataVerifiedPreyConf = preyConfJs.verifyPreyConfData();
      preyConfJs.verifyExistingData(
        dataVerifiedPreyConf,
        1,
        (verified) => {
          sinon.assert.match(verified, false);
          done();
        },
      );
    });

    it('Comparing data with null', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_default.conf');
      const dataVerifiedPreyConf = preyConfJs.verifyPreyConfData();
      preyConfJs.verifyExistingData(
        dataVerifiedPreyConf,
        null,
        (verified) => {
          sinon.assert.match(verified, false);
          done();
        },
      );
    });
    it('Existing data from database with prey_apikey_devicekey.conf', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_default.conf');
      const dataVerifiedPreyConf = preyConfJs.verifyPreyConfData();
      preyConfJs.verifyExistingData(
        dataVerifiedPreyConf,
        databaseData,
        (verified) => {
          sinon.assert.match(verified, true);
          done();
        },
      );
    });
    it('Existing data from database with prey_apikey_nodevicekey.conf', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_apikey_nodevicekey.conf');
      const dataVerifiedPreyConf = preyConfJs.verifyPreyConfData();
      preyConfJs.verifyExistingData(
        dataVerifiedPreyConf,
        databaseData,
        (verified) => {
          sinon.assert.match(verified, true);
          done();
        },
      );
    });

    it('Existing data from database with prey_bad_format.conf', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_bad_format.conf');
      const dataVerifiedPreyConf = preyConfJs.verifyPreyConfData();
      preyConfJs.verifyExistingData(
        dataVerifiedPreyConf,
        databaseData,
        (verified) => {
          sinon.assert.match(verified, false);
          done();
        },
      );
    });

    it('Existing data from database with prey_default.conf', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_default.conf');
      const dataVerifiedPreyConf = preyConfJs.verifyPreyConfData();
      preyConfJs.verifyExistingData(
        dataVerifiedPreyConf,
        databaseData,
        (verified) => {
          sinon.assert.match(verified, true);
          done();
        },
      );
    });

    it('Existing data from database with prey_noapikey_devicekey.conf', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_noapikey_devicekey.conf');
      const dataVerifiedPreyConf = preyConfJs.verifyPreyConfData();
      preyConfJs.verifyExistingData(
        dataVerifiedPreyConf,
        databaseData,
        (verified) => {
          sinon.assert.match(verified, true);
          done();
        },
      );
    });
    it('Existing data from database with prey_noformat.conf', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_noformat.conf');
      const dataVerifiedPreyConf = preyConfJs.verifyPreyConfData();
      preyConfJs.verifyExistingData(
        dataVerifiedPreyConf,
        databaseData,
        (verified) => {
          sinon.assert.match(verified, false);
          done();
        },
      );
    });
    it('Existing data from database with prey_noprotocol.conf', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_noprotocol.conf');
      const dataVerifiedPreyConf = preyConfJs.verifyPreyConfData();
      preyConfJs.verifyExistingData(
        dataVerifiedPreyConf,
        databaseData,
        (verified) => {
          sinon.assert.match(verified, false);
          done();
        },
      );
    });
    it('Existing data from database with prey_nohost.conf', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_nohost.conf');
      const dataVerifiedPreyConf = preyConfJs.verifyPreyConfData();
      preyConfJs.verifyExistingData(
        dataVerifiedPreyConf,
        databaseData,
        (verified) => {
          sinon.assert.match(verified, true);
          done();
        },
      );
    });
  });
  describe('startVerifyPreyConf', () => {
    it('should verify default prey.conf - Good structure, but no api key or device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_default.conf');
      const dataVerifiedPreyConf = preyConfJs.startVerifyPreyConf();
      should(dataVerifiedPreyConf).have.property('constitution', true);
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
      should(dataVerifiedPreyConf).have.property('constitution', {});
      should(dataVerifiedPreyConf).have.property('apiKeyValue', false);
      should(dataVerifiedPreyConf).have.property('deviceKeyValue', false);
      done();
    });

    it('should verify prey.conf - Good structure, no api key and device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_noapikey_devicekey.conf');
      const dataVerifiedPreyConf = preyConfJs.startVerifyPreyConf();
      should(dataVerifiedPreyConf).have.property('constitution', true);
      should(dataVerifiedPreyConf).have.property('apiKeyValue', false);
      should(dataVerifiedPreyConf).have.property('deviceKeyValue', true);
      done();
    });

    it('should verify prey.conf - Good structure, api key and no device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_apikey_nodevicekey.conf');
      const dataVerifiedPreyConf = preyConfJs.startVerifyPreyConf();
      should(dataVerifiedPreyConf).have.property('constitution', true);
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
      should(dataVerifiedPreyConf).have.property('constitution', true);
      should(dataVerifiedPreyConf).have.property('apiKeyValue', true);
      should(dataVerifiedPreyConf).have.property('deviceKeyValue', true);
      done();
    });

    it('should verify prey.conf - No protocol', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_noprotocol.conf');
      const dataVerifiedPreyConf = preyConfJs.startVerifyPreyConf();
      should(dataVerifiedPreyConf).have.property('constitution', true);
      should(dataVerifiedPreyConf).have.property('apiKeyValue', true);
      should(dataVerifiedPreyConf).have.property('deviceKeyValue', true);
      done();
    });
  });

  describe('trySaveData', () => {
    it('should try to save default prey.conf - Good structure, but no api key or device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_default.conf');
      const dataToSave = preyConfJs.trySaveData();
      sinon.assert.match(dataToSave, null);
      done();
    });

    it('should verify default prey.conf - Good structure, but no api key or device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_default.conf');
      const dataToSave = preyConfJs.trySaveData();
      sinon.assert.match(dataToSave, null);
      done();
    });

    it('should verify prey.conf - Good structure, api key and device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_apikey_devicekey.conf');
      const dataToSave = preyConfJs.trySaveData();
      const whatever = {
        auto_connect: 'false',
        auto_update: 'true',
        'control-panel.api_key': 'apikey',
        'control-panel.device_key': 'devicekey',
        'control-panel.host': 'solid.preyproject.com',
        'control-panel.location_aware': 'false',
        'control-panel.protocol': 'https',
        'control-panel.scan_hardware': 'false',
        'control-panel.send_status_info': 'true',
        download_edge: 'false',
        send_crash_reports: 'true',
      };
      sinon.assert.match(dataToSave, whatever);
      done();
    });

    it('should verify prey.conf - no structure', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_noformat.conf');
      const dataToSave = preyConfJs.trySaveData();
      sinon.assert.match(dataToSave, null);
      done();
    });

    it('should verify prey.conf - Good structure, no api key and device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_noapikey_devicekey.conf');
      const dataToSave = preyConfJs.trySaveData();
      sinon.assert.match(dataToSave, null);
      done();
    });

    it('should verify prey.conf - Good structure, api key and no device key', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_apikey_nodevicekey.conf');
      const dataToSave = preyConfJs.trySaveData();
      sinon.assert.match(dataToSave, null);
      done();
    });

    it('should verify prey.conf - Bad structure', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_bad_format.conf');
      const dataToSave = preyConfJs.trySaveData();
      sinon.assert.match(dataToSave, null);
      done();
    });

    it('should verify prey.conf - No host', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_nohost.conf');
      const dataToSave = preyConfJs.trySaveData();
      sinon.assert.match(dataToSave, null);
      done();
    });

    it('should verify prey.conf - No protocol', (done) => {
      preyConfJs.preyConfPath = join(__dirname, 'utils', 'prey_noprotocol.conf');
      const dataToSave = preyConfJs.trySaveData();
      sinon.assert.match(dataToSave, null);
      done();
    });
  });
});

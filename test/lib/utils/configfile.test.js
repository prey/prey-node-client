/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');

const CONFIGFILE_PATH = require.resolve('../../../lib/utils/configfile');
const PREYCONF_PATH = require.resolve('../../../lib/agent/utils/prey-configuration/preyconf');
const STORAGE_PATH = require.resolve('../../../lib/agent/utils/storage');

describe('ConfigFile', () => {
  let preyconfModule;
  let storageModule;

  // Returns a fresh ConfigFile instance with getDataDb returning the given dbData object.
  // Pass null to simulate "no preyconf in DB" (triggers readWithoutVerification fallback).
  const loadFresh = (dbData, fallbackData = null) => {
    preyconfModule = require(PREYCONF_PATH);
    storageModule = require(STORAGE_PATH);

    const getDataDbStub = sinon.stub(preyconfModule, 'getDataDb')
      .callsFake((key, cb) => {
        if (key === 'preyconf') {
          if (dbData !== null) {
            cb(null, [{ value: JSON.stringify(dbData) }]);
          } else {
            cb(null, null);
          }
        } else {
          // shouldPreyCFile lookup in the fallback path
          cb(null, [{ value: 'true' }]);
        }
        return getDataDbStub;
      });

    sinon.stub(preyconfModule, 'saveDataToDb').callsFake((_data, cb) => cb && cb());

    sinon.stub(preyconfModule, 'readWithoutVerification').callsFake((cb) => {
      cb(null, fallbackData);
    });

    sinon.stub(storageModule, 'do').callsFake((_op, _params, cb) => cb && cb());

    delete require.cache[CONFIGFILE_PATH];
    return require('../../../lib/utils/configfile');
  };

  afterEach(() => {
    sinon.restore();
    delete require.cache[CONFIGFILE_PATH];
  });

  describe('load() — main DB path', () => {
    it('loads a boolean false value from DB correctly', () => {
      const config = loadFresh({ 'control-panel.send_encryption_keys': false });

      expect(config.getData('control-panel.send_encryption_keys')).to.equal(false);
    });

    it('loads a boolean false for scan_hardware from DB correctly', () => {
      const config = loadFresh({ 'control-panel.scan_hardware': false });

      expect(config.getData('control-panel.scan_hardware')).to.equal(false);
    });

    it('keeps the default true when the key is absent from DB data', () => {
      const config = loadFresh({ 'control-panel.scan_hardware': true });

      expect(config.getData('control-panel.send_encryption_keys')).to.equal(true);
    });

    it('loads truthy values correctly (regression guard)', () => {
      const config = loadFresh({
        'control-panel.send_encryption_keys': true,
        'control-panel.host': 'custom.host.com',
      });

      expect(config.getData('control-panel.send_encryption_keys')).to.equal(true);
      expect(config.getData('control-panel.host')).to.equal('custom.host.com');
    });

    it('loads null api_key from DB (not yet configured)', () => {
      const config = loadFresh({ 'control-panel.api_key': null });

      expect(config.getData('control-panel.api_key')).to.equal(null);
    });
  });

  describe('load() — fallback path (readWithoutVerification)', () => {
    it('loads a boolean false from prey.conf fallback data', () => {
      const config = loadFresh(null, { 'control-panel.send_encryption_keys': false });

      expect(config.getData('control-panel.send_encryption_keys')).to.equal(false);
    });

    it('keeps default when key is absent from prey.conf fallback data', () => {
      const config = loadFresh(null, { 'control-panel.scan_hardware': true });

      expect(config.getData('control-panel.send_encryption_keys')).to.equal(true);
    });
  });

  describe('setFullFromData()', () => {
    it('applies a boolean false value to preyConfiguration', (done) => {
      const config = loadFresh({});

      // default is true
      expect(config.getData('control-panel.send_encryption_keys')).to.equal(true);

      config.setFullFromData({ 'control-panel.send_encryption_keys': false }, () => {
        expect(config.getData('control-panel.send_encryption_keys')).to.equal(false);
        done();
      });
    });

    it('preserves existing value when key is absent from the data argument', (done) => {
      const config = loadFresh({});

      config.setFullFromData({ 'control-panel.scan_hardware': true }, () => {
        // send_encryption_keys was not in data, default true must be kept
        expect(config.getData('control-panel.send_encryption_keys')).to.equal(true);
        done();
      });
    });

    it('applies truthy values correctly (regression guard)', (done) => {
      const config = loadFresh({ 'control-panel.send_encryption_keys': false });

      config.setFullFromData({ 'control-panel.send_encryption_keys': true }, () => {
        expect(config.getData('control-panel.send_encryption_keys')).to.equal(true);
        done();
      });
    });
  });
});

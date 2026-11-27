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
  // identData is the raw value of the deviceIdentificationData row (null: no row).
  const loadFresh = (dbData, fallbackData = null, identData = null) => {
    preyconfModule = require(PREYCONF_PATH);
    storageModule = require(STORAGE_PATH);

    const getDataDbStub = sinon.stub(preyconfModule, 'getDataDb')
      .callsFake((key, cb) => {
        if (key === 'preyconf') {
          if (dbData !== null) {
            cb(null, [{ value: typeof dbData === 'string' ? dbData : JSON.stringify(dbData) }]);
          } else {
            cb(null, null);
          }
        } else if (key === 'deviceIdentificationData') {
          cb(null, identData === null ? null : [{ value: identData }]);
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

  describe('load() — unreadable preyconf row', () => {
    // What the 1.13.43 quote bug leaves in every keys row: a cut JSON prefix.
    const corrupt = '{"errors":{"unknown option ';

    it('restores keys, host and settings from prey.conf instead of the defaults', () => {
      const config = loadFresh(corrupt, {
        'control-panel.api_key': 'abc123',
        'control-panel.device_key': 'dev1',
        'control-panel.host': 'solid.preyhq.com',
        send_crash_reports: true,
      });

      expect(config.getData('control-panel.api_key')).to.equal('abc123');
      expect(config.getData('control-panel.device_key')).to.equal('dev1');
      expect(config.getData('control-panel.host')).to.equal('solid.preyhq.com');
      expect(config.getData('send_crash_reports')).to.equal(true);
    });

    it('saves the restored configuration to the database', () => {
      loadFresh(corrupt, { 'control-panel.host': 'solid.preyhq.com' });

      const saved = preyconfModule.saveDataToDb.lastCall.args[0];
      expect(saved['control-panel.host']).to.equal('solid.preyhq.com');
    });

    it('replaces the corrupted shouldPreyCFile row', () => {
      loadFresh(corrupt, { 'control-panel.api_key': 'a', 'control-panel.device_key': 'd' });

      const update = storageModule.do.getCalls()
        .find((c) => c.args[0] === 'update' && c.args[1].id === 'shouldPreyCFile');
      expect(update).to.exist;
      expect(update.args[1].values).to.equal('true');
    });

    it('falls back to the defaults when prey.conf cannot be read', () => {
      const config = loadFresh(corrupt, null);

      expect(config.getData('control-panel.host')).to.equal('solid.preyproject.com');
      expect(config.getData('control-panel.api_key')).to.equal(null);
      expect(preyconfModule.saveDataToDb.called).to.equal(true);
    });

    describe('device key (missing from prey.conf until correctPreyConf runs)', () => {
      const ident = JSON.stringify({ device_key: 'dk-linked', payload: {}, created_at: 1 });
      const prey = { 'control-panel.api_key': 'abc123', 'control-panel.device_key': '' };

      it('restores it from deviceIdentificationData and saves it', () => {
        const config = loadFresh(corrupt, prey, ident);

        expect(config.getData('control-panel.device_key')).to.equal('dk-linked');
        const saved = preyconfModule.saveDataToDb.lastCall.args[0];
        expect(saved['control-panel.device_key']).to.equal('dk-linked');
      });

      it('restores it even when prey.conf cannot be read', () => {
        const config = loadFresh(corrupt, null, ident);

        expect(config.getData('control-panel.device_key')).to.equal('dk-linked');
      });

      it('keeps the device key of prey.conf when it has one', () => {
        const config = loadFresh(corrupt, { ...prey, 'control-panel.device_key': 'dk-conf' }, ident);

        expect(config.getData('control-panel.device_key')).to.equal('dk-conf');
      });

      it('leaves it empty when deviceIdentificationData is unreadable', () => {
        const config = loadFresh(corrupt, prey, '{not json');

        expect(config.getData('control-panel.device_key')).to.equal('');
        expect(preyconfModule.saveDataToDb.called).to.equal(true);
      });

      it('leaves it empty when there is no deviceIdentificationData row', () => {
        const config = loadFresh(corrupt, prey, null);

        expect(config.getData('control-panel.device_key')).to.equal('');
      });

      it('does not look at deviceIdentificationData when the preyconf row is just missing', () => {
        const config = loadFresh(null, prey, ident);

        expect(config.getData('control-panel.device_key')).to.equal('');
        const asked = preyconfModule.getDataDb.getCalls().map((c) => c.args[0]);
        expect(asked).to.not.include('deviceIdentificationData');
      });
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

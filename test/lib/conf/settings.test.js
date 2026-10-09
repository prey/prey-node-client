/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
// test/lib/conf/settings.test.js
const sinon = require('sinon');
const { expect } = require('chai');
const preyconf = require('../../../lib/agent/utils/prey-configuration/preyconf');
const config = require('../../../lib/utils/configfile');
const settings = require('../../../lib/conf/settings');
const { Operetta } = require('../../../lib/conf/utils/operetta');

describe('settings conf module', () => {
  describe('update', () => {
    let savedAutoConnect;
    let savedHost;
    let savedDailyLimit;

    beforeEach(() => {
      // config is a frozen singleton, so its methods can't be stubbed. Instead we
      // stub the DB write it delegates to and operate on the in-memory config.
      sinon.stub(preyconf, 'saveDataToDb').callsFake((_data, cb) => cb && cb());
      savedAutoConnect = config.preyConfiguration.auto_connect;
      savedHost = config.preyConfiguration['control-panel.host'];
      savedDailyLimit = config.preyConfiguration.exceptions_daily_limit;
      config.preyConfiguration.auto_connect = false;
      config.preyConfiguration['control-panel.host'] = 'solid.preyproject.com';
      config.preyConfiguration.exceptions_daily_limit = 50;
    });

    afterEach(() => {
      config.preyConfiguration.auto_connect = savedAutoConnect;
      config.preyConfiguration['control-panel.host'] = savedHost;
      config.preyConfiguration.exceptions_daily_limit = savedDailyLimit;
      sinon.restore();
    });

    it('returns an error via callback when no value is provided (no crash)', () => {
      const cb = sinon.spy();

      // Reproduces OWCA-644: `settings update <key>` with no value used to throw
      // `TypeError: Cannot read properties of undefined (reading 'toLowerCase')`.
      expect(() => settings.update({ positional: ['auto_connect'] }, cb)).to.not.throw();
      expect(cb.calledWith(sinon.match.instanceOf(Error))).to.be.true;
      // config must be left untouched.
      expect(config.preyConfiguration.auto_connect).to.equal(false);
    });

    it('returns an error via callback when the key is missing', () => {
      const cb = sinon.spy();

      settings.update({ positional: [] }, cb);

      expect(cb.calledWith(sinon.match.instanceOf(Error))).to.be.true;
    });

    it("converts a 'true'/'false' string value to a boolean before saving", () => {
      const cb = sinon.spy();

      settings.update({ positional: ['auto_connect', 'true'] }, cb);

      expect(config.preyConfiguration.auto_connect).to.equal(true);
    });

    it('passes a valid non-boolean value through unchanged', () => {
      const cb = sinon.spy();

      settings.update({ positional: ['control-panel.host', 'solid.preyhq.com'] }, cb);

      expect(config.preyConfiguration['control-panel.host']).to.equal('solid.preyhq.com');
    });

    it('returns an error and never saves for an immutable key', () => {
      const cb = sinon.spy();
      const before = config.preyConfiguration['control-panel.permissions.wifi_location'];

      settings.update({ positional: ['control-panel.permissions.wifi_location', 'true'] }, cb);

      expect(cb.calledWith(sinon.match.instanceOf(Error))).to.be.true;
      expect(config.preyConfiguration['control-panel.permissions.wifi_location']).to.equal(before);
    });

    it('saves a config key not listed in reqPreyConf without throwing', () => {
      const cb = sinon.spy();

      // `exceptions_daily_limit` exists in the config but not in reqPreyConf, so
      // reqPreyConf.filter() returns []. Because [] is truthy, the old
      // `if (dataFromName)` check reached `dataFromName[0].possiblevalues` and threw
      // `TypeError: Cannot read properties of undefined`.
      expect(() => settings.update({ positional: ['exceptions_daily_limit', '100'] }, cb)).to.not.throw();
      expect(config.preyConfiguration.exceptions_daily_limit).to.equal('100');
    });

    // Integration test through the operetta `run()` adapter, exactly as cli.js wires it
    // (`cmd.keyword('key'); run(cmd, settings.update)`). Proves the missing-value case
    // flows an Error back to the callback without throwing or hanging (OWCA-644).
    it('does not throw or hang when driven through the operetta run() adapter without a value', (done) => {
      const cmd = new Operetta(['auto_connect'], 'update');
      cmd.keyword('key', 'Key to replace.');

      const run = (scope, command) => {
        scope.start((values) => {
          command(values, (err) => {
            expect(err).to.be.an.instanceOf(Error);
            done();
          });
        });
      };

      expect(() => run(cmd, settings.update)).to.not.throw();
    });
  });
});

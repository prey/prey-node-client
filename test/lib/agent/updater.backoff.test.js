/* eslint-disable no-unused-expressions */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('agent/updater - backoff after a failed activation', () => {
  const NOW = Date.UTC(2026, 9, 28, 12, 0, 0);
  const HOUR = 60 * 60 * 1000;
  let updater;
  let fakePackage;
  let updateClient;
  let failure;

  beforeEach(() => {
    updater = rewire('../../../lib/agent/updater');
    failure = null;
    updateClient = sinon.stub().callsFake((version, cb) => cb());

    fakePackage = {
      new_version_available: sinon.stub().callsFake((branch, current, cb) => cb(null, '1.13.42', 'https://downloads')),
      check_update_success: sinon.stub().callsFake((v, p, cb) => cb()),
      get_upgrade_failure: sinon.stub().callsFake((cb) => cb(null, failure)),
    };

    updater.__set__('common', { package: fakePackage, version: '1.13.41' });
    updater.__set__('config', { load: (cb) => cb(), getData: () => false });
    updater.__set__('needle', { put: (url, data, opts, cb) => cb() });
    updater.__set__('update_client', updateClient);
    updater.__set__('logger', {
      info: sinon.stub(),
      notice: sinon.stub(),
      warn: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
    });
    // skip the delayed winsvc check
    updater.__set__('setTimeout', () => {});
    updater.__set__('Date', { now: () => NOW });
    updater.check_enabled = true;
    updater.upgrading = false;
  });

  afterEach(() => sinon.restore());

  it('skips the upgrade when the same version failed less than 3h ago', (done) => {
    failure = { version: '1.13.42', at: NOW - HOUR, message: 'Activation failed' };

    updater.check_for_update((err) => {
      // an error makes the agent boot normally (lib/agent/index.js)
      expect(err).to.be.an('error');
      expect(err.message).to.contain('Skipping upgrade to 1.13.42');
      expect(err.message).to.contain('60 min ago');
      expect(updateClient.called).to.equal(false);
      done();
    });
  });

  it('upgrades again once the backoff window is over', (done) => {
    failure = { version: '1.13.42', at: NOW - 3 * HOUR, message: 'Activation failed' };

    updater.check_for_update(() => {
      expect(updateClient.calledOnce).to.equal(true);
      done();
    });
  });

  it('upgrades right away to a different version than the one that failed', (done) => {
    failure = { version: '1.13.41', at: NOW - 60 * 1000, message: 'Activation failed' };

    updater.check_for_update(() => {
      expect(updateClient.calledOnce).to.equal(true);
      expect(updateClient.firstCall.args[0]).to.equal('1.13.42');
      done();
    });
  });

  it('upgrades when there is no recorded failure', (done) => {
    updater.check_for_update(() => {
      expect(updateClient.calledOnce).to.equal(true);
      done();
    });
  });

  it('does not let a failure timestamped in the future block upgrades', (done) => {
    failure = { version: '1.13.42', at: NOW + HOUR, message: 'clock moved' };

    updater.check_for_update(() => {
      expect(updateClient.calledOnce).to.equal(true);
      done();
    });
  });

  it('keeps the backoff when a version check fails in between (goes through check_update_success)', (done) => {
    // real lib/package with an in-memory keys table, so the updater -> package path is exercised
    const pkg = rewire('../../../lib/package');
    const rows = {};
    pkg.__set__('storage', {
      do: (perform, opts, cb) => {
        if (perform === 'set') { rows[opts.id] = opts.data.value; return cb(null); }
        if (perform === 'query') return cb(null, rows[opts.data] !== undefined ? [{ id: opts.data, value: rows[opts.data] }] : []);
        if (perform === 'del') { delete rows[opts.id]; return cb(null); }
        if (perform === 'all') return cb(null, []);
        return cb(null);
      },
    });
    pkg.new_version_available = sinon.stub().callsFake((branch, current, cb) => cb(new Error('getaddrinfo ENOTFOUND')));
    updater.__set__('common', { package: pkg, version: '1.13.41' });
    rows[pkg.UPGRADE_FAILURE_KEY] = JSON.stringify({ version: '1.13.42', at: NOW - HOUR, message: 'Activation failed' });

    updater.check_for_update(() => {
      // network is back on the next check: the failed version must still be held back
      pkg.new_version_available = sinon.stub().callsFake((branch, current, cb) => cb(null, '1.13.42', 'https://downloads'));
      updater.check_enabled = true;
      updater.check_for_update((err) => {
        expect(err).to.be.an('error');
        expect(err.message).to.contain('Skipping upgrade to 1.13.42');
        expect(updateClient.called).to.equal(false);
        done();
      });
    });
  });

  it('upgrades when reading the failure record errors out', (done) => {
    fakePackage.get_upgrade_failure.callsFake((cb) => cb(new Error('db locked'), null));

    updater.check_for_update(() => {
      expect(updateClient.calledOnce).to.equal(true);
      done();
    });
  });
});

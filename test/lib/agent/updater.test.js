/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('updater', () => {
  let updater;
  let packageStub;
  let configStub;
  let loggerStub;
  let paths;

  beforeEach(() => {
    updater = rewire('../../../lib/agent/updater');

    packageStub = {
      new_version_available: sinon.stub(),
      check_update_success: sinon.stub().callsFake((_ver, _path, cb) => cb()),
    };
    configStub = {
      load: sinon.stub().callsFake((cb) => cb()),
      getData: sinon.stub().returns(undefined),
    };
    loggerStub = {
      info: sinon.stub(),
      debug: sinon.stub(),
      notice: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    };
    paths = { current: '/opt/prey', package: '/opt/prey', versions: undefined };

    updater.__set__('common', { package: packageStub, version: '1.13.41' });
    updater.__set__('system', { paths });
    updater.__set__('config', configStub);
    updater.__set__('logger', loggerStub);
    updater.check_enabled = true;
    updater.upgrading = false;
  });

  afterEach(() => {
    updater.stop_checking();
    sinon.restore();
  });

  describe('check_for_update', () => {
    describe('static install (paths.versions undefined)', () => {
      it('calls back with a NO_VERSIONS_SUPPORT error', (done) => {
        updater.check_for_update((err) => {
          expect(err).to.be.instanceOf(Error);
          expect(err.code).to.equal('NO_VERSIONS_SUPPORT');
          done();
        });
      });

      it('never asks the server for a new version', (done) => {
        updater.check_for_update(() => {
          expect(packageStub.new_version_available.called).to.be.false;
          expect(packageStub.check_update_success.called).to.be.false;
          expect(configStub.load.called).to.be.false;
          done();
        });
      });

      it('calls back exactly once, synchronously', () => {
        const cb = sinon.stub();
        updater.check_for_update(cb);
        expect(cb.calledOnce).to.be.true;
      });

      it('does not throw when called without a callback (setInterval path)', () => {
        expect(() => updater.check_for_update()).to.not.throw();
        expect(() => updater.check_for_update('not-a-function')).to.not.throw();
        expect(packageStub.new_version_available.called).to.be.false;
      });

      it('leaves check_enabled untouched', (done) => {
        updater.check_for_update(() => {
          expect(updater.check_enabled).to.be.true;
          done();
        });
      });
    });

    describe('versioned install (paths.versions set)', () => {
      let clock;

      beforeEach(() => {
        clock = sinon.useFakeTimers();
        paths.versions = '/usr/lib/prey/versions';
      });

      afterEach(() => {
        clock.restore();
      });

      it('still checks for a new version', (done) => {
        packageStub.new_version_available.callsFake((_branch, _current, cb) => cb(null, false));

        updater.check_for_update((err) => {
          expect(packageStub.new_version_available.calledOnce).to.be.true;
          expect(packageStub.new_version_available.firstCall.args[0]).to.equal('stable');
          expect(packageStub.check_update_success.calledOnce).to.be.true;
          expect(packageStub.check_update_success.firstCall.args[1]).to.equal('/usr/lib/prey/versions');
          expect(err).to.be.instanceOf(Error);
          expect(err.code).to.not.equal('NO_VERSIONS_SUPPORT');
          done();
        });
      });
    });
  });

  describe('check_every', () => {
    let setIntervalSpy;

    beforeEach(() => {
      setIntervalSpy = sinon.stub().returns({});
      updater.__set__('setInterval', setIntervalSpy);
    });

    it('arms no timers on a static install and does not throw without a callback (index.js boot path)', () => {
      expect(() => updater.check_every(3 * 60 * 60 * 1000)).to.not.throw();
      expect(setIntervalSpy.called).to.be.false;
    });

    it('passes the NO_VERSIONS_SUPPORT error to a callback when given one', () => {
      const cb = sinon.stub();
      updater.check_every(1000, cb);
      expect(cb.calledOnce).to.be.true;
      expect(cb.firstCall.args[0].code).to.equal('NO_VERSIONS_SUPPORT');
      expect(setIntervalSpy.called).to.be.false;
    });

    it('arms the timers on a versioned install', () => {
      paths.versions = '/usr/lib/prey/versions';
      updater.check_every(1000);
      expect(setIntervalSpy.calledTwice).to.be.true;
    });
  });

  describe('check (upgrade command) on a static install', () => {
    it('rejects the reset target with NO_VERSIONS_SUPPORT before checking', (done) => {
      packageStub.delete_attempts = sinon.stub();
      updater.check(null, 'reset', {}, (err) => {
        expect(err.code).to.equal('NO_VERSIONS_SUPPORT');
        expect(packageStub.delete_attempts.called).to.be.false;
        expect(packageStub.new_version_available.called).to.be.false;
        done();
      });
    });
  });
});

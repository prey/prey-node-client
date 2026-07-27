'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const Module = require('module');

describe('lib/system/windows/index', () => {
  describe('find_logged_user', () => {
    let windowsModule;
    let execStub;
    let originalModuleLoad;
    let commonMock;

    beforeEach(() => {
      execStub = sinon.stub();
      commonMock = {
        helpers: { is_greater_or_equal: sinon.stub().returns(true) },
        os_release: '10.0.0',
      };

      // Intercept the lazy require('../../agent/common') inside find_logged_user
      originalModuleLoad = Module._load;
      Module._load = function (request, ...args) {
        if (request === '../../agent/common') return commonMock;
        return originalModuleLoad.apply(this, arguments);
      };

      windowsModule = rewire('../../../../lib/system/windows/index');
      windowsModule.__set__('exec', execStub);
    });

    afterEach(() => {
      Module._load = originalModuleLoad;
      sinon.restore();
    });

    it('calls callback with error when exec throws synchronously (e.g. EROFS)', (done) => {
      const spawnError = new Error('spawn EROFS');
      execStub.throws(spawnError);

      windowsModule.find_logged_user((err) => {
        expect(err).to.equal(spawnError);
        done();
      });
    });

    it('calls callback with error when first exec fails via callback', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(new Error('exec failed')));

      windowsModule.find_logged_user((err) => {
        expect(err.message).to.equal('No logged user found.');
        done();
      });
    });

    it('calls callback with error when first exec returns empty stdout', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(null, ''));

      windowsModule.find_logged_user((err) => {
        expect(err.message).to.equal('No logged user found.');
        done();
      });
    });

    it('returns username on Windows < 10 without running session checks', (done) => {
      commonMock.helpers.is_greater_or_equal.returns(false);
      execStub.callsFake((cmd, opts, cb) => cb(null, 'DOMAIN\\testuser'));

      windowsModule.find_logged_user((err, user) => {
        expect(err).to.be.null;
        expect(user).to.equal('testuser');
        done();
      });
    });

    it('falls back to username when second exec throws synchronously', (done) => {
      execStub.onFirstCall().callsFake((cmd, opts, cb) => cb(null, 'DOMAIN\\testuser'));
      execStub.onSecondCall().throws(new Error('spawn EROFS'));

      windowsModule.find_logged_user((err, user) => {
        expect(err).to.be.null;
        expect(user).to.equal('testuser');
        done();
      });
    });

    it('falls back to username when second exec fails via callback', (done) => {
      execStub.onFirstCall().callsFake((cmd, opts, cb) => cb(null, 'DOMAIN\\testuser'));
      execStub.onSecondCall().callsFake((cmd, opts, cb) => cb(new Error('exec failed')));

      windowsModule.find_logged_user((err, user) => {
        expect(err).to.be.null;
        expect(user).to.equal('testuser');
        done();
      });
    });

    it('falls back to username when third exec throws synchronously', (done) => {
      execStub.onFirstCall().callsFake((cmd, opts, cb) => cb(null, 'DOMAIN\\testuser'));
      execStub.onSecondCall().callsFake((cmd, opts, cb) => cb(null, '1'));
      execStub.onThirdCall().throws(new Error('spawn EROFS'));

      windowsModule.find_logged_user((err, user) => {
        expect(err).to.be.null;
        expect(user).to.equal('testuser');
        done();
      });
    });

    it('falls back to username when third exec fails via callback', (done) => {
      execStub.onFirstCall().callsFake((cmd, opts, cb) => cb(null, 'DOMAIN\\testuser'));
      execStub.onSecondCall().callsFake((cmd, opts, cb) => cb(null, '1'));
      execStub.onThirdCall().callsFake((cmd, opts, cb) => cb(new Error('exec failed')));

      windowsModule.find_logged_user((err, user) => {
        expect(err).to.be.null;
        expect(user).to.equal('testuser');
        done();
      });
    });

    it('returns username when no lock screen is detected', (done) => {
      execStub.onFirstCall().callsFake((cmd, opts, cb) => cb(null, 'DOMAIN\\testuser'));
      execStub.onSecondCall().callsFake((cmd, opts, cb) => cb(null, '1'));
      execStub.onThirdCall().callsFake((cmd, opts, cb) => cb(null, '2')); // different session ID

      windowsModule.find_logged_user((err, user) => {
        expect(err).to.be.null;
        expect(user).to.equal('testuser');
        done();
      });
    });

    it('calls callback with error when system is on Windows Lock Screen', (done) => {
      execStub.onFirstCall().callsFake((cmd, opts, cb) => cb(null, 'DOMAIN\\testuser'));
      execStub.onSecondCall().callsFake((cmd, opts, cb) => cb(null, '1'));
      execStub.onThirdCall().callsFake((cmd, opts, cb) => cb(null, '1')); // same session ID = locked

      windowsModule.find_logged_user((err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.include('Lock Screen');
        done();
      });
    });
  });
});

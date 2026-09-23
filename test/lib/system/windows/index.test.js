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

    it('calls callback with error when exec fails via callback', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(new Error('exec failed')));

      windowsModule.find_logged_user((err) => {
        expect(err.message).to.equal('No logged user found.');
        done();
      });
    });

    it('calls callback with error when exec returns empty stdout', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(null, ''));

      windowsModule.find_logged_user((err) => {
        expect(err.message).to.equal('No logged user found.');
        done();
      });
    });

    it('returns username on Windows < 10 with a single exec (no lock detection)', (done) => {
      commonMock.helpers.is_greater_or_equal.returns(false);
      execStub.callsFake((cmd, opts, cb) => cb(null, 'DOMAIN\\testuser'));

      windowsModule.find_logged_user((err, user) => {
        expect(err).to.be.null;
        expect(user).to.equal('testuser');
        expect(execStub.calledOnce).to.be.true;
        done();
      });
    });

    it('returns username on Windows 10+ when not locked (PREY_LOCKED=0)', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(null, 'PREY_USER=DOMAIN\\testuser|PREY_LOCKED=0\r\n'));

      windowsModule.find_logged_user((err, user) => {
        expect(err).to.be.null;
        expect(user).to.equal('testuser');
        done();
      });
    });

    it('spawns exactly ONE powershell process on Windows 10+ (was three)', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(null, 'PREY_USER=DOMAIN\\testuser|PREY_LOCKED=0'));

      windowsModule.find_logged_user((err, user) => {
        expect(err).to.be.null;
        expect(user).to.equal('testuser');
        expect(execStub.calledOnce).to.be.true;
        done();
      });
    });

    it('calls callback with error when system is on Windows Lock Screen (PREY_LOCKED=1)', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(null, 'PREY_USER=DOMAIN\\testuser|PREY_LOCKED=1'));

      windowsModule.find_logged_user((err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.include('Lock Screen');
        done();
      });
    });

    it('lock screen error message contains no embedded newlines', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(null, 'PREY_USER=DOMAIN\\testuser|PREY_LOCKED=1\r\n'));

      windowsModule.find_logged_user((err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.not.include('\r');
        expect(err.message).to.not.include('\n');
        expect(err.message).to.include('Lock Screen');
        done();
      });
    });

    it('fails open to a plain username parse on unexpected output format', (done) => {
      // If the single-line PREY_USER/PREY_LOCKED format ever drifts, fall back
      // to treating stdout as the raw UserName.
      execStub.callsFake((cmd, opts, cb) => cb(null, 'DOMAIN\\testuser'));

      windowsModule.find_logged_user((err, user) => {
        expect(err).to.be.null;
        expect(user).to.equal('testuser');
        done();
      });
    });

    it('errors when the resolved username is empty (PREY_USER=)', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(null, 'PREY_USER=|PREY_LOCKED=0'));

      windowsModule.find_logged_user((err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('No logged user found.');
        done();
      });
    });

    it('does not interpolate the username into the command and sanitizes it', (done) => {
      // The username is derived inside PowerShell now, so the JS-built command
      // must not embed the raw username (no injection surface). O'Brien -> O_Brien.
      execStub.callsFake((cmd, opts, cb) => {
        expect(cmd).to.not.include("O'Brien");
        cb(null, "PREY_USER=DOMAIN\\O'Brien|PREY_LOCKED=0");
      });

      windowsModule.find_logged_user((err, user) => {
        expect(err).to.be.null;
        expect(user).to.equal('O_Brien');
        expect(execStub.calledOnce).to.be.true;
        done();
      });
    });

    it('includes -NoProfile in the powershell exec call', (done) => {
      execStub.callsFake((cmd, opts, cb) => {
        expect(cmd).to.include('-NoProfile');
        cb(null, 'PREY_USER=DOMAIN\\testuser|PREY_LOCKED=0');
      });

      windowsModule.find_logged_user(() => done());
    });
  });

  describe('process_running', () => {
    let windowsModule;
    let execStub;

    beforeEach(() => {
      execStub = sinon.stub();
      windowsModule = rewire('../../../../lib/system/windows/index');
      windowsModule.__set__('exec', execStub);
    });

    afterEach(() => {
      sinon.restore();
    });

    it('returns true when process name appears in tasklist output', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(null, 'notepad.exe   1234 Console'));

      windowsModule.process_running('notepad.exe', (running) => {
        expect(running).to.be.true;
        done();
      });
    });

    it('returns false when process is not in tasklist output', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(null, 'No tasks are running which match the specified criteria.'));

      windowsModule.process_running('notepad.exe', (running) => {
        expect(running).to.be.false;
        done();
      });
    });

    it('returns false when exec throws synchronously (EROFS)', (done) => {
      execStub.throws(new Error('spawn EROFS'));

      windowsModule.process_running('notepad.exe', (running) => {
        expect(running).to.be.false;
        done();
      });
    });
  });

  describe('get_lang', () => {
    let windowsModule;
    let execStub;

    beforeEach(() => {
      execStub = sinon.stub();
      windowsModule = rewire('../../../../lib/system/windows/index');
      windowsModule.__set__('exec', execStub);
    });

    afterEach(() => {
      sinon.restore();
    });

    it('returns "en" when registry output does not contain 0C0A', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(null, 'Installlanguage    0409'));

      windowsModule.get_lang((lang) => {
        expect(lang).to.equal('en');
        done();
      });
    });

    it('returns "es" when registry output contains 0C0A', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(null, 'Installlanguage    0C0A'));

      windowsModule.get_lang((lang) => {
        expect(lang).to.equal('es');
        done();
      });
    });

    it('returns "en" fallback when exec throws synchronously (EROFS)', (done) => {
      execStub.throws(new Error('spawn EROFS'));

      windowsModule.get_lang((lang) => {
        expect(lang).to.equal('en');
        done();
      });
    });
  });

  describe('get_current_hostname', () => {
    let windowsModule;
    let execStub;

    beforeEach(() => {
      execStub = sinon.stub();
      windowsModule = rewire('../../../../lib/system/windows/index');
      windowsModule.__set__('exec', execStub);
    });

    afterEach(() => {
      sinon.restore();
    });

    it('returns hostname from exec stdout', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(null, 'MY-PC\r\n'));

      windowsModule.get_current_hostname((err, hostname) => {
        expect(err).to.be.null;
        expect(hostname).to.equal('MY-PC');
        done();
      });
    });

    it('propagates error from exec callback', (done) => {
      const execErr = new Error('exec failed');
      execStub.callsFake((cmd, opts, cb) => cb(execErr, ''));

      windowsModule.get_current_hostname((err) => {
        expect(err).to.equal(execErr);
        done();
      });
    });

    it('propagates error when exec throws synchronously (EROFS)', (done) => {
      const spawnErr = new Error('spawn EROFS');
      execStub.throws(spawnErr);

      windowsModule.get_current_hostname((err) => {
        expect(err).to.equal(spawnErr);
        done();
      });
    });
  });

  describe('run_as_admin', () => {
    let windowsModule;
    let needleStub;

    const simulateResponse = (responseObj) => {
      needleStub.post.callsFake((_url, _body, _opts, resCb) => {
        resCb(null, { statusCode: 200 }, JSON.stringify(responseObj));
      });
    };

    beforeEach(() => {
      windowsModule = rewire('../../../../lib/system/windows/index');
      needleStub = { post: sinon.stub(), get: sinon.stub() };
      windowsModule.__set__('needle', needleStub);
    });

    afterEach(() => {
      sinon.restore();
    });

    it('calls cb(null, out) on success response', (done) => {
      simulateResponse({ error: false, output: { key: 'val' } });

      windowsModule.run_as_admin('test-action', {}, (err, out) => {
        expect(err).to.be.null;
        expect(out).to.deep.equal({ key: 'val' });
        done();
      });
    });

    it('calls cb(Error, null) when error===true and output is null (plain action)', (done) => {
      simulateResponse({ error: true, output: null });

      windowsModule.run_as_admin('wipe', {}, (err, out) => {
        expect(err).to.be.instanceOf(Error);
        expect(out).to.be.null;
        done();
      });
    });

    it('cb is called exactly once on plain-action top-level error (no double call)', (done) => {
      simulateResponse({ error: true, output: null });

      const spy = sinon.spy();
      windowsModule.run_as_admin('wipe', {}, spy);

      setImmediate(() => {
        sinon.assert.calledOnce(spy);
        done();
      });
    });

    it('uses message from output as Error.message when available', (done) => {
      simulateResponse({ error: true, output: { message: 'disk not found' } });

      windowsModule.run_as_admin('wipe', {}, (err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('disk not found');
        done();
      });
    });

    it('calls cb(null, out) when error===true but output already has inner error (struct action — delegates to action handler)', (done) => {
      const innerOut = { error: true, code: 1, message: 'drive not found' };
      simulateResponse({ error: true, output: innerOut });

      windowsModule.run_as_admin('full-wipe', {}, (err, out) => {
        expect(err).to.be.null;
        expect(out).to.deep.equal(innerOut);
        done();
      });
    });

    it('calls cb(null, out) when error===true but output is array with inner disk error (encrypt/decrypt)', (done) => {
      const innerOut = [{ disk: 'C:', error: true, code: 2, message: 'bitlocker failed' }];
      simulateResponse({ error: true, output: innerOut });

      windowsModule.run_as_admin('encrypt', {}, (err, out) => {
        expect(err).to.be.null;
        expect(out).to.deep.equal(innerOut);
        done();
      });
    });

    it('calls cb(Error) on network error', (done) => {
      const netErr = new Error('ECONNREFUSED');
      needleStub.post.callsFake((_url, _body, _opts, resCb) => {
        resCb(netErr, null, null);
      });

      windowsModule.run_as_admin('wipe', {}, (err) => {
        expect(err).to.equal(netErr);
        done();
      });
    });
  });

  describe('get_as_admin', () => {
    let windowsModule;
    let needleStub;

    const simulateResponse = (responseObj) => {
      needleStub.post.callsFake((_url, _body, _opts, resCb) => {
        resCb(null, { statusCode: 200 }, JSON.stringify(responseObj));
      });
    };

    beforeEach(() => {
      windowsModule = rewire('../../../../lib/system/windows/index');
      needleStub = { post: sinon.stub(), get: sinon.stub() };
      windowsModule.__set__('needle', needleStub);
    });

    afterEach(() => {
      sinon.restore();
    });

    it('calls cb(null, out) on success', (done) => {
      simulateResponse({ error: false, output: { tpm: true } });

      windowsModule.get_as_admin('tpmModule', (err, out) => {
        expect(err).to.be.null;
        expect(out).to.deep.equal({ tpm: true });
        done();
      });
    });

    it('calls cb(Error) when error===true and output is null (provider failure)', (done) => {
      simulateResponse({ error: true, output: null });

      windowsModule.get_as_admin('tpmModule', (err) => {
        expect(err).to.be.instanceOf(Error);
        done();
      });
    });

    it('calls cb(Error) on network error', (done) => {
      const netErr = new Error('ECONNREFUSED');
      needleStub.post.callsFake((_url, _body, _opts, resCb) => {
        resCb(netErr, null, null);
      });

      windowsModule.get_as_admin('tpmModule', (err) => {
        expect(err).to.equal(netErr);
        done();
      });
    });
  });
});

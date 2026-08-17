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

    it('sanitizes username with apostrophe before PowerShell interpolation', (done) => {
      execStub.onFirstCall().callsFake((cmd, opts, cb) => cb(null, "DOMAIN\\O'Brien\r\n"));
      execStub.onSecondCall().callsFake((cmd, opts, cb) => {
        expect(cmd).to.not.include("'O'Brien'");
        expect(cmd).to.include('O_Brien');
        cb(null, '1');
      });
      execStub.onThirdCall().callsFake((cmd, opts, cb) => cb(null, '2'));

      windowsModule.find_logged_user((err, _user) => {
        expect(err).to.be.null;
        done();
      });
    });

    it('includes -NoProfile in all powershell exec calls', (done) => {
      const commands = [];
      execStub.callsFake((cmd, opts, cb) => {
        commands.push(cmd);
        if (commands.length === 1) cb(null, 'DOMAIN\\testuser\r\n');
        else if (commands.length === 2) cb(null, '1');
        else cb(null, '2');
      });

      windowsModule.find_logged_user(() => {
        commands.filter((c) => c.startsWith('powershell')).forEach((c) => {
          expect(c).to.include('-NoProfile');
        });
        done();
      });
    });

    it('lock screen error message contains no embedded newlines', (done) => {
      execStub.onFirstCall().callsFake((cmd, opts, cb) => cb(null, 'DOMAIN\\testuser\r\n'));
      execStub.onSecondCall().callsFake((cmd, opts, cb) => cb(null, '1'));
      execStub.onThirdCall().callsFake((cmd, opts, cb) => cb(null, '1'));

      windowsModule.find_logged_user((err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.not.include('\r');
        expect(err.message).to.not.include('\n');
        expect(err.message).to.include('Lock Screen');
        done();
      });
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

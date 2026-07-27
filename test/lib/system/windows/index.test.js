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
});

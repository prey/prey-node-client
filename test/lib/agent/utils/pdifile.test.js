/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const assert = require('assert');
const sinon = require('sinon');

describe('PID file utilities', () => {
  // eslint-disable-next-line global-require
  const pidfile = require('../../../../lib/agent/utils/pidfile');
  describe('remove', () => {
    it('should call the callback with an error if the file does not exist', () => {
      const pidFile = 'non-existent.pid';
      pidfile.remove(pidFile, (err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.code).to.equal('ENOENT');
      });
    });
  });

  describe('read', () => {
    it('should call callback with null error and obj when all operations succeed', (done) => {
      const file = 'test.pid';
      const statStub = sinon.stub(pidfile, 'statFile').callsFake((_file, cb) => {
        cb(null, { size: 10 });
      });
      const readStub = sinon.stub(pidfile, 'readFile').callsFake((_file, cb) => {
        cb(null, 1234);
      });
      const permStub = sinon.stub(pidfile, 'checkPidPermissions').callsFake((pid, cb) => {
        cb(null);
      });
      pidfile.read(file, (err, obj) => {
        assert.strictEqual(err, null);
        assert.deepStrictEqual(obj, { stat: { size: 10 }, pid: 1234 });
        statStub.restore();
        readStub.restore();
        permStub.restore();
        done();
      });
    });
    it('should call callback with error when statFile fails', (done) => {
      const file = 'test.pid';
      const statStub = sinon.stub(pidfile, 'statFile').callsFake((_file, cb) => {
        cb(new Error('stat error'));
      });
      pidfile.read(file, (err) => {
        assert.strictEqual(err.message, 'stat error');
        statStub.restore();
        done();
      });
    });
    it('should call callback with error when readFile fails', (done) => {
      const file = 'test.pid';
      const statStub = sinon.stub(pidfile, 'statFile').callsFake((_file, cb) => {
        cb(null, { size: 10 });
      });
      const readStub = sinon.stub(pidfile, 'readFile').callsFake((_file, cb) => {
        cb(new Error('read error'));
      });
      pidfile.read(file, (err) => {
        assert.strictEqual(err.message, 'read error');
        statStub.restore();
        readStub.restore();
        done();
      });
    });
    it('should call callback with error when checkPidPermissions fails', (done) => {
      const file = 'test.pid';
      const statStub = sinon.stub(pidfile, 'statFile').callsFake((_file, cb) => {
        cb(null, { size: 10 });
      });
      const readStub = sinon.stub(pidfile, 'readFile').callsFake((_file, cb) => {
        cb(null, 1234);
      });
      const permStub = sinon.stub(pidfile, 'checkPidPermissions').callsFake((pid, cb) => {
        cb(new Error('perm error'));
      });
      pidfile.read(file, (err) => {
        assert.strictEqual(err.message, 'perm error');
        statStub.restore();
        readStub.restore();
        permStub.restore();
        done();
      });
    });
  });

  describe('checkPidPermissions', () => {
    let killStub;

    beforeEach(() => {
      killStub = sinon.stub(process, 'kill');
    });

    afterEach(() => {
      killStub.restore();
    });

    it('should return null on successful permission check', (done) => {
      killStub.callsFake(() => {});
      pidfile.checkPidPermissions(process.pid, (err) => {
        expect(err).to.be.null;
        done();
      });
    });

    it('should return null on EPERM error', (done) => {
      const error = new Error('EPERM error');
      error.code = 'EPERM';
      killStub.callsFake(() => { throw error; });
      pidfile.checkPidPermissions(-1, (err) => {
        expect(err).to.be.null;
        done();
      });
    });

    it('should return ESRCH error on non-existent pid', (done) => {
      const error = new Error('EPERM error');
      error.code = 'ESRCH';
      killStub.callsFake(() => { throw error; });
      pidfile.checkPidPermissions(99999, (err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.code).to.be.equal('ESRCH');
        done();
      });
    });

    it('should not throw on non-function callback', () => {
      pidfile.checkPidPermissions(process.pid, null);
      expect(() => {}).not.to.throw();
    });
  });

  describe('pidfile', () => {
    let fsStub;

    beforeEach(() => {
      // eslint-disable-next-line global-require
      fsStub = sinon.stub(require('fs'), 'readFile');
    });

    afterEach(() => {
      fsStub.restore();
    });

    describe('readFileRaw', () => {
      it('should read file correctly', (done) => {
        const file = 'test.pid';
        const content = '1234';
        fsStub.yields(null, content);
        pidfile.readFileRaw(file, (err, str) => {
          expect(err).to.be.null;
          expect(str).to.be.equal(content);
          done();
        });
      });

      it('should return error if readFile fails', (done) => {
        const file = 'test.pid';
        const error = new Error('Error reading file');
        fsStub.yields(error);
        pidfile.readFileRaw(file, (err, str) => {
          expect(err).to.be.equal(error);
          expect(str).to.be.undefined;
          done();
        });
      });
    });

    describe('parsePid', () => {
      it('should parse pid correctly', (done) => {
        const str = '1234';
        pidfile.parsePid(str, (err, pid) => {
          expect(err).to.be.null;
          expect(pid).to.be.equal(1234);
          done();
        });
      });
    });

    describe('readFile', () => {
      it('should read file and parse pid correctly', (done) => {
        const file = 'test.pid';
        const content = '1234';
        fsStub.yields(null, content);
        pidfile.readFile(file, (err, pid) => {
          expect(err).to.be.null;
          expect(pid).to.be.equal(1234);
          done();
        });
      });

      it('should return error if readFile fails', (done) => {
        const file = 'test.pid';
        const error = new Error('Error reading file');
        fsStub.yields(error);
        pidfile.readFile(file, (err, pid) => {
          expect(err).to.be.equal(error);
          expect(pid).to.be.undefined;
          done();
        });
      });
    });
  });
});

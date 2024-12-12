const rewire = require('rewire');
const sinon = require('sinon');
const { expect } = require('chai');
const { storageConst, osConst } = require('../../../../../lib/constants');

// eslint-disable-next-line no-undef
describe('restore function', () => {
  let restoreRewired;
  // eslint-disable-next-line no-undef
  beforeEach(() => {
    restoreRewired = rewire('../../../../../lib/agent/utils/storage/restore');
    restoreRewired.verifyTempDatabase = sinon.stub().callsFake(() => false);
    restoreRewired.database = {
      createDatabase: sinon.stub().callsFake((backupDBPath, cb) => {
        cb(null, {});
      }),
      backupDatabase: sinon.stub().callsFake((db, cb) => cb(null)),
      closeDatabase: sinon.stub().callsFake((db, cb) => cb(null)),
    };
    restoreRewired.execCmd = sinon.stub().callsFake((cmd, cb) => cb(null, null, null));
  });
  // eslint-disable-next-line no-undef
  afterEach(() => {
  });
  // eslint-disable-next-line no-undef
  it('should return error on non-Windows platform', () => {
    restoreRewired.osName = 'mac';
    const cb = sinon.stub();
    restoreRewired.restore(cb);
    // eslint-disable-next-line no-unused-expressions
    expect(cb.calledWith(`${storageConst.TITLE}: ${osConst.RESTRICTION.ONLY_WINDOWS}`)).to.be.true;
  });
  // eslint-disable-next-line no-undef
  it('should return success when temporary database does not exist', () => {
    restoreRewired.osName = 'windows';
    const cb = sinon.stub();
    restoreRewired.restore(cb);
    // eslint-disable-next-line no-unused-expressions
    expect(cb.calledWith()).to.be.true;
  });
  // eslint-disable-next-line no-undef
  it('should return error when createDatabase fails', () => {
    restoreRewired.osName = 'windows';
    restoreRewired.verifyTempDatabase = sinon.stub().callsFake(() => true);
    restoreRewired.database = {
      createDatabase: sinon.stub().callsFake((backupDBPath, cb) => {
        cb(new Error('createDatabase error'));
      }),
      backupDatabase: sinon.stub().callsFake((db, cb) => cb(null)),
      closeDatabase: sinon.stub().callsFake((db, cb) => cb(null)),
    };

    restoreRewired.restore((err) => {
      expect(err.message).to.be.equal(storageConst.SQLITE_ACCESS_ERR);
    });
  });
  // eslint-disable-next-line no-undef
  it('should return error when backupDatabase fails', () => {
    restoreRewired.osName = 'windows';
    restoreRewired.verifyTempDatabase = sinon.stub().callsFake(() => true);
    restoreRewired.database = {
      createDatabase: sinon.stub().callsFake((backupDBPath, cb) => {
        cb(null, {});
      }),
      backupDatabase: sinon.stub().callsFake((db, cb) => cb(new Error('backupDatabase error'))),
      closeDatabase: sinon.stub().callsFake((db, cb) => cb(null)),
    };
    restoreRewired.restore((err) => {
      expect(err.message).to.be.equal('backupDatabase error');
    });
  });
  // eslint-disable-next-line no-undef
  it('should return error when closeDatabase fails', () => {
    restoreRewired.osName = 'windows';
    restoreRewired.verifyTempDatabase = sinon.stub().callsFake(() => true);
    restoreRewired.database = {
      createDatabase: sinon.stub().callsFake((backupDBPath, cb) => {
        cb(null, {});
      }),
      backupDatabase: sinon.stub().callsFake((db, cb) => cb()),
      closeDatabase: sinon.stub().callsFake((db, cb) => cb(new Error('closeDatabase error'))),
    };
    restoreRewired.restore((err) => {
      expect(err.message).to.be.equal(`${storageConst.BACKUP.CLOSING_ERROR}: closeDatabase error`);
    });
  });
  // eslint-disable-next-line no-undef
  it('should return error when deleting backup file fails', () => {
    restoreRewired.osName = 'windows';

    restoreRewired.verifyTempDatabase = sinon.stub().callsFake(() => true);
    restoreRewired.database = {
      createDatabase: sinon.stub().callsFake((backupDBPath, cb) => {
        cb(null, {});
      }),
      backupDatabase: sinon.stub().callsFake((db, cb) => cb()),
      closeDatabase: sinon.stub().callsFake((db, cb) => cb()),
    };
    restoreRewired.execCmd = sinon.stub().callsFake((cmd, cb) => cb(new Error('delete error'), null, null));
    restoreRewired.restore((err) => {
      expect(err.message).to.be.equal(`${storageConst.BACKUP.DELETING_ERROR}: delete error`);
    });
  });
  // eslint-disable-next-line no-undef
  it('should return success when restore is successful', () => {
    restoreRewired.osName = 'windows';
    restoreRewired.verifyTempDatabase = sinon.stub().callsFake(() => true);
    restoreRewired.database = {
      createDatabase: sinon.stub().callsFake((backupDBPath, cb) => {
        cb(null, {});
      }),
      backupDatabase: sinon.stub().callsFake((db, cb) => cb()),
      closeDatabase: sinon.stub().callsFake((db, cb) => cb()),
    };
    const cb = sinon.stub();
    restoreRewired.restore(cb);
    // eslint-disable-next-line no-unused-expressions
    expect(cb.calledWith(`${storageConst.BACKUP.RESTORE_SUCCESS}`)).to.be.true;
  });
});

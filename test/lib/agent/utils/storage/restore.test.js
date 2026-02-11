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
  it('should return error when createDatabase fails', (done) => {
    restoreRewired.osName = 'windows';
    restoreRewired.verifyTempDatabase = sinon.stub().callsFake(() => true);
    restoreRewired.database = {
      createDatabase: sinon.stub().callsFake((backupDBPath, cb) => {
        cb(new Error('createDatabase error'));
      }),
      backupDatabase: sinon.stub().callsFake((db, cb) => cb(null)),
      closeDatabase: sinon.stub().callsFake((db, cb) => cb(null)),
    };
    // Stub checkDataInTempDB to avoid real SQLite access
    restoreRewired.__set__('checkDataInTempDB', (whatToSearch, cb) => {
      if (whatToSearch === 'fenixReady') {
        cb(true); // fenixReady found
      } else if (whatToSearch === 'restored') {
        cb(false); // restored not found, so proceed with restore
      }
    });

    restoreRewired.restore((err) => {
      expect(err.message).to.be.equal(storageConst.SQLITE_ACCESS_ERR);
      done();
    });
  });
  // eslint-disable-next-line no-undef
  it('should return error when stepDatabase fails', (done) => {
    restoreRewired.osName = 'windows';
    restoreRewired.verifyTempDatabase = sinon.stub().callsFake(() => true);
    restoreRewired.database = {
      createDatabase: sinon.stub().callsFake((_backupDBPath, cb) => {
        cb(null, {});
      }),
      backupDatabase: sinon.stub().callsFake((_db, _dbpath, cb) => cb({})),
      stepDatabase: sinon.stub().callsFake((_db, cb) => cb(new Error('backupDatabase error'))),
    };
    // Stub checkDataInTempDB to avoid real SQLite access
    // fenixReady should return true, restored should return false to continue with restore
    restoreRewired.__set__('checkDataInTempDB', (whatToSearch, cb) => {
      if (whatToSearch === 'fenixReady') {
        cb(true); // fenixReady found
      } else if (whatToSearch === 'restored') {
        cb(false); // restored not found, so proceed with restore
      }
    });
    restoreRewired.restore((err) => {
      expect(err.message).to.be.equal('backupDatabase error');
      done();
    });
  });
  // eslint-disable-next-line no-undef
  it('should return error when closeDatabase fails', (done) => {
    restoreRewired.osName = 'windows';
    restoreRewired.verifyTempDatabase = sinon.stub().callsFake(() => true);
    restoreRewired.database = {
      createDatabase: sinon.stub().callsFake((_backupDBPath, cb) => {
        cb(null, {});
      }),
      backupDatabase: sinon.stub().callsFake((_db, _dbpath, cb) => cb({})),
      stepDatabase: sinon.stub().callsFake((_db, cb) => cb()),
      closeDatabase: sinon.stub().callsFake((_db, _dbpath, cb) => {
        cb('closeDatabase error');
      }),
    };
    // Stub checkDataInTempDB to avoid real SQLite access
    restoreRewired.__set__('checkDataInTempDB', (whatToSearch, cb) => {
      if (whatToSearch === 'fenixReady') {
        cb(true);
      } else if (whatToSearch === 'restored') {
        cb(false);
      }
    });
    restoreRewired.restore((err) => {
      expect(err.message).to.be.equal(`${storageConst.BACKUP.CLOSING_ERROR}: closeDatabase error`);
      done();
    });
  });
  // eslint-disable-next-line no-undef
  it('should return error when deleting backup file fails', (done) => {
    restoreRewired.osName = 'windows';

    restoreRewired.verifyTempDatabase = sinon.stub().callsFake(() => true);
    restoreRewired.database = {
      createDatabase: sinon.stub().callsFake((_backupDBPath, cb) => {
        cb(null, {});
      }),
      backupDatabase: sinon.stub().callsFake((_db, _dbpath, cb) => cb({})),
      stepDatabase: sinon.stub().callsFake((_db, cb) => cb()),
      closeDatabase: sinon.stub().callsFake((_db, _dbpath, cb) => {
        cb();
      }),
      deleteDatabase: sinon.stub().callsFake((_cmd, cb) => cb('delete error', null, null)),
    };
    // Stub checkDataInTempDB to avoid real SQLite access
    restoreRewired.__set__('checkDataInTempDB', (whatToSearch, cb) => {
      if (whatToSearch === 'fenixReady') {
        cb(true);
      } else if (whatToSearch === 'restored') {
        cb(false);
      }
    });
    // Stub addCheckDataToTempDB to avoid real SQLite access
    restoreRewired.__set__('addCheckDataToTempDB', (cb) => {
      if (cb) cb();
    });
    restoreRewired.restore((err) => {
      expect(err.message).to.be.equal(`${storageConst.BACKUP.DELETING_ERROR}: delete error`);
      done();
    });
  });
  // eslint-disable-next-line no-undef
  it('should return success when restore is successful', (done) => {
    restoreRewired.osName = 'windows';
    restoreRewired.verifyTempDatabase = sinon.stub().callsFake(() => true);
    restoreRewired.database = {
      createDatabase: sinon.stub().callsFake((_backupDBPath, cb) => {
        cb(null, {});
      }),
      backupDatabase: sinon.stub().callsFake((_db, _dbpath, cb) => cb({})),
      stepDatabase: sinon.stub().callsFake((_db, cb) => cb()),
      closeDatabase: sinon.stub().callsFake((_db, _dbpath, cb) => {
        cb();
      }),
      deleteDatabase: sinon.stub().callsFake((_cmd, cb) => cb(null, null, null)),
    };
    // Stub checkDataInTempDB to avoid real SQLite access
    restoreRewired.__set__('checkDataInTempDB', (whatToSearch, cb) => {
      if (whatToSearch === 'fenixReady') {
        cb(true);
      } else if (whatToSearch === 'restored') {
        cb(false);
      }
    });
    // Stub addCheckDataToTempDB to avoid real SQLite access
    restoreRewired.__set__('addCheckDataToTempDB', (cb) => {
      if (cb) cb();
    });
    restoreRewired.restore((_err, msg) => {
      expect(msg).to.be.equal(`${storageConst.BACKUP.RESTORE_SUCCESS}`);
      done();
    });
  });
});

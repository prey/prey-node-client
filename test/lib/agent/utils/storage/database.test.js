const { expect } = require('chai');
const sinon = require('sinon');
const { exec } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const {
  createDatabase,
  backupDatabase,
  stepDatabase,
  closeDatabase,
  deleteDatabase,
} = require('../../../../../lib/agent/utils/storage/database');

describe('Database Module', () => {
  let dbStub, execStub, dbConstructorStub;

  beforeEach(() => {
    dbStub = sinon.createStubInstance(sqlite3.Database);
    dbConstructorStub = sinon.stub(sqlite3, 'Database');
    execStub = sinon.stub(exec);
  });

  afterEach(() => {
    sinon.restore();
  });

/*   describe('createDatabase', () => {
    it('should successfully create a new database', (done) => {
      const dbPath = 'test.db';
  
      // Mock the sqlite3.Database constructor
      dbConstructorStub.callsFake((path, callback) => {
        expect(path).to.equal(dbPath); // Assert correct path is passed
        callback(null); // Simulate success
        return dbStub; // Return the stubbed db instance
      });
  
      createDatabase(dbPath, (err, db) => {
        // Assertions for callback
        expect(err).to.be.null;
        expect(db).to.equal(dbStub);
        expect(dbConstructorStub.calledOnceWithExactly(dbPath)).to.be.true;
        done();
      });
    });
  
    it('should return an error if database creation fails', (done) => {
      const dbPath = 'test.db';
      const error = new Error('Database creation failed');
  
      // Simulate an error in the constructor
      dbConstructorStub.callsFake((path, callback) => {
        callback(error); // Simulate error
      });
  
      createDatabase(dbPath, (err, db) => {
        // Assertions for error
        expect(err).to.equal(error);
        expect(db).to.be.undefined;
        done();
      });
    });
  }); */

  describe('backupDatabase', () => {
    it('should call the callback with the backup instance', () => {
      const backupStub = {};
      dbStub.backup = sinon.stub().returns(backupStub);

      const path = 'backup.db';
      const cb = sinon.spy();

      backupDatabase(dbStub, path, cb);

      expect(dbStub.backup.calledOnceWithExactly(path)).to.be.true;
      expect(cb.calledOnceWithExactly(backupStub)).to.be.true;
    });
  });

  /* describe('stepDatabase', () => {
    it('should call the callback without error if step is successful', (done) => {
      dbStub.step = sinon.stub().callsFake((_, callback) => {
        callback(null);
      });

      stepDatabase(dbStub, (err) => {
        expect(err).to.be.null;
        done();
      });
    });

    it('should return an error if step fails', (done) => {
      const error = 'Step failed';
      dbStub.step = sinon.stub().callsFake((_, callback) => {
        callback(error);
      });

      stepDatabase(dbStub, (err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal(error);
        done();
      });
    });
  }); */

  describe('closeDatabase', () => {
    /* it('should successfully close the database and backup', (done) => {
      dbStub.finish = sinon.stub().callsFake((callback) => {
        callback(null);
      });
      const backupTempDBStub = {
        close: sinon.stub().callsFake((callback) => {
          callback(null);
        }),
      };

      closeDatabase(dbStub, backupTempDBStub, (err) => {
        expect(err).to.be.null;
        expect(dbStub.finish.calledOnce).to.be.true;
        expect(backupTempDBStub.close.calledOnce).to.be.true;
        done();
      });
    }); */

    /* it('should return an error if finish fails', (done) => {
      const error = new Error('Finish failed');
      dbStub.finish = sinon.stub().callsFake((callback) => {
        callback(error);
      });

      closeDatabase(dbStub, {}, (err) => {
        expect(err).to.equal(error);
        done();
      });
    }); */

    /* it('should return an error if closing backup fails', (done) => {
      dbStub.finish = sinon.stub().callsFake((callback) => {
        callback(null);
      });
      const backupTempDBStub = {
        close: sinon.stub().callsFake((callback) => {
          callback(new Error('Close failed'));
        }),
      };

      closeDatabase(dbStub, backupTempDBStub, (err) => {
        expect(err.message).to.equal('Close failed');
        done();
      });
    }); */
  });

 /*  describe('deleteDatabase', () => {
    it('should delete the database and call the callback without error', (done) => {
      const path = 'backup.db';
      execStub.callsFake((command, callback) => {
        expect(command).to.equal(`del /f ${path}`);
        callback(null, '', '');
      });

      deleteDatabase(path, (err, stderr) => {
        expect(err).to.be.null;
        expect(stderr).to.equal('');
        done();
      });
    });

    it('should return an error if deletion fails', (done) => {
      const path = 'backup.db';
      const error = new Error('Delete failed');
      execStub.callsFake((command, callback) => {
        expect(command).to.equal(`del /f ${path}`);
        callback(error, '', 'Error output');
      });

      deleteDatabase(path, (err, stderr) => {
        expect(err).to.equal(error);
        expect(stderr).to.equal('Error output');
        done();
      });
    });
  }); */
});

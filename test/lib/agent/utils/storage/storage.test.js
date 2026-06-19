/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const rewire = require('rewire');
const sinon = require('sinon');
const { expect } = require('chai');

const SQLITE_ACCESS_ERR = 'Access denied to commands database, must run agent as prey user';

describe('storage_fns', () => {
  let storage;
  let dbInstance;

  // Builds a sqlite3 mock. openErr simulates a failed db.open callback.
  const makeSqlite3 = (openErr = null) => ({
    Database: function FakeDB(path, cb) {
      this.run = sinon.stub().callsFake((sql, c) => c && c(null));
      this.all = sinon.stub().callsFake((sql, c) => c && c(null, []));
      this.close = sinon.stub().callsFake((c) => c && c());
      dbInstance = this;
      // Async to ensure dbComm assignment completes before the callback fires.
      process.nextTick(() => cb && cb(openErr));
    },
  });

  beforeEach(() => {
    storage = rewire('../../../../../lib/agent/utils/storage');
    storage.__set__('dbExists', () => '/fake');
    storage.__set__('sqlite3', makeSqlite3());
  });

  afterEach(() => {
    storage = null;
    dbInstance = null;
  });

  // ─── set ────────────────────────────────────────────────────────────────────

  describe('set', () => {
    it('should INSERT a new record when the id does not exist', (done) => {
      storage.storage_fns.set(
        { type: 'keys', id: 'testkey', data: { value: 'hello' } },
        (err) => {
          expect(err).to.be.null;
          // run call #1 = CREATE TABLE, call #2 = INSERT
          expect(dbInstance.run.callCount).to.equal(2);
          expect(dbInstance.run.secondCall.args[0]).to.match(/^INSERT INTO keys/);
          done();
        },
      );
      // dbInstance.all default returns [] (no existing row)
    });

    it('should return "Already registered" error when id already exists', (done) => {
      storage.storage_fns.set(
        { type: 'keys', id: 'hostname', data: { value: 'NEW' } },
        (err) => {
          expect(err).to.be.an('error');
          expect(err.message).to.include('Already registered');
          expect(err.message).to.include('hostname');
          done();
        },
      );
      // Override all to return an existing row
      dbInstance.all.callsFake((sql, c) => c(null, [{ id: 'hostname', value: 'OLD' }]));
    });

    it('should close db connection when id already exists', (done) => {
      storage.storage_fns.set(
        { type: 'keys', id: 'hostname', data: { value: 'NEW' } },
        () => {
          expect(dbInstance.close.called).to.be.true;
          done();
        },
      );
      dbInstance.all.callsFake((sql, c) => c(null, [{ id: 'hostname', value: 'OLD' }]));
    });

    it('should propagate init error to callback', (done) => {
      storage.__set__('sqlite3', makeSqlite3({ code: 'SQLITE_CANTOPEN' }));
      storage.storage_fns.set(
        { type: 'keys', id: 'testkey', data: { value: 'hello' } },
        (err) => {
          expect(err).to.be.an('error');
          done();
        },
      );
    });

    it('should return SQLITE_ACCESS_ERR when INSERT fails with SQLITE_READONLY', (done) => {
      storage.storage_fns.set(
        { type: 'keys', id: 'testkey', data: { value: 'hello' } },
        (err) => {
          expect(err).to.equal(SQLITE_ACCESS_ERR);
          done();
        },
      );
      dbInstance.run.onSecondCall().callsFake((sql, c) => c({ code: 'SQLITE_READONLY' }));
    });

    it('should close db connection when dbComm.all errors', (done) => {
      storage.storage_fns.set(
        { type: 'keys', id: 'testkey', data: { value: 'hello' } },
        () => {
          expect(dbInstance.close.called).to.be.true;
          done();
        },
      );
      dbInstance.all.callsFake((sql, c) => c(new Error('DB_ERROR')));
    });
  });

  // ─── del ────────────────────────────────────────────────────────────────────

  describe('del', () => {
    it('should execute DELETE and call back without error', (done) => {
      storage.storage_fns.del({ type: 'keys', id: 'mykey' }, (err) => {
        expect(err).to.be.null;
        expect(dbInstance.run.callCount).to.equal(2);
        expect(dbInstance.run.secondCall.args[0]).to.include("DELETE FROM keys WHERE id = 'mykey'");
        done();
      });
    });

    it('should return SQLITE_ACCESS_ERR when DELETE fails with SQLITE_READONLY', (done) => {
      storage.storage_fns.del({ type: 'keys', id: 'mykey' }, (err) => {
        expect(err).to.equal(SQLITE_ACCESS_ERR);
        done();
      });
      dbInstance.run.onSecondCall().callsFake((sql, c) => c({ code: 'SQLITE_READONLY' }));
    });

    it('should propagate init error to callback', (done) => {
      storage.__set__('sqlite3', makeSqlite3({ code: 'SQLITE_CANTOPEN' }));
      storage.storage_fns.del({ type: 'keys', id: 'mykey' }, (err) => {
        expect(err).to.be.an('error');
        done();
      });
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should UPDATE with a single column and value', (done) => {
      storage.storage_fns.update(
        { type: 'keys', id: 'hostname', columns: 'value', values: 'PC-02' },
        (err) => {
          expect(err).to.be.null;
          const sql = dbInstance.run.secondCall.args[0];
          expect(sql).to.include("value = 'PC-02'");
          expect(sql).to.include("WHERE id = 'hostname'");
          done();
        },
      );
    });

    it('should UPDATE with an array of columns and values', (done) => {
      storage.storage_fns.update(
        { type: 'keys', id: 'testkey', columns: ['c1', 'c2'], values: ['v1', 'v2'] },
        (err) => {
          expect(err).to.be.null;
          const sql = dbInstance.run.secondCall.args[0];
          expect(sql).to.include("c1 = 'v1'");
          expect(sql).to.include("c2 = 'v2'");
          done();
        },
      );
    });

    it('should return an error when columns and values arrays differ in length', (done) => {
      storage.storage_fns.update(
        { type: 'keys', id: 'testkey', columns: ['c1', 'c2'], values: ['v1'] },
        (err) => {
          expect(err).to.be.an('error');
          done();
        },
      );
    });

    it('should return an error when columns array is empty', (done) => {
      storage.storage_fns.update(
        { type: 'keys', id: 'testkey', columns: [], values: [] },
        (err) => {
          expect(err).to.be.an('error');
          done();
        },
      );
    });

    it('should return SQLITE_ACCESS_ERR when UPDATE fails with SQLITE_READONLY', (done) => {
      storage.storage_fns.update(
        { type: 'keys', id: 'hostname', columns: 'value', values: 'PC-02' },
        (err) => {
          expect(err).to.equal(SQLITE_ACCESS_ERR);
          done();
        },
      );
      dbInstance.run.onSecondCall().callsFake((sql, c) => c({ code: 'SQLITE_READONLY' }));
    });

    it('should propagate init error to callback', (done) => {
      storage.__set__('sqlite3', makeSqlite3({ code: 'SQLITE_CANTOPEN' }));
      storage.storage_fns.update(
        { type: 'keys', id: 'hostname', columns: 'value', values: 'PC-02' },
        (err) => {
          expect(err).to.be.an('error');
          done();
        },
      );
    });
  });

  // ─── all ────────────────────────────────────────────────────────────────────

  describe('all', () => {
    it('should return all rows from the table', (done) => {
      const mockRows = [{ id: 'k1', value: 'v1' }, { id: 'k2', value: 'v2' }];
      storage.storage_fns.all({ type: 'keys' }, (err, rows) => {
        expect(err).to.be.null;
        expect(rows).to.deep.equal(mockRows);
        done();
      });
      dbInstance.all.callsFake((sql, c) => c(null, mockRows));
    });

    it('should propagate init error to callback', (done) => {
      storage.__set__('sqlite3', makeSqlite3({ code: 'SQLITE_CANTOPEN' }));
      storage.storage_fns.all({ type: 'keys' }, (err) => {
        expect(err).to.be.an('error');
        done();
      });
    });

    it('should call back with (err, null) on a non-ENOENT SELECT error', (done) => {
      storage.storage_fns.all({ type: 'keys' }, (err, rows) => {
        expect(err).to.be.an('error');
        expect(rows).to.be.null;
        done();
      });
      dbInstance.all.callsFake((sql, c) => c(new Error('DB_ERROR')));
    });

    it('should close db connection on SELECT error', (done) => {
      storage.storage_fns.all({ type: 'keys' }, () => {
        expect(dbInstance.close.called).to.be.true;
        done();
      });
      dbInstance.all.callsFake((sql, c) => c(new Error('DB_ERROR')));
    });
  });

  // ─── query ──────────────────────────────────────────────────────────────────

  describe('query', () => {
    it('should return matching rows', (done) => {
      const mockRows = [{ id: 'hostname', value: 'PC-01' }];
      storage.storage_fns.query(
        { type: 'keys', column: 'id', data: 'hostname' },
        (err, rows) => {
          expect(err).to.be.null;
          expect(rows).to.deep.equal(mockRows);
          done();
        },
      );
      dbInstance.all.callsFake((sql, c) => c(null, mockRows));
    });

    it('should call back with (err, []) on ENOENT error', (done) => {
      storage.storage_fns.query(
        { type: 'keys', column: 'id', data: 'hostname' },
        (err, rows) => {
          expect(rows).to.deep.equal([]);
          done();
        },
      );
      dbInstance.all.callsFake((sql, c) => c({ code: 'ENOENT' }));
    });

    it('should close db connection on ENOENT error', (done) => {
      storage.storage_fns.query(
        { type: 'keys', column: 'id', data: 'hostname' },
        () => {
          expect(dbInstance.close.called).to.be.true;
          done();
        },
      );
      dbInstance.all.callsFake((sql, c) => c({ code: 'ENOENT' }));
    });

    it('should propagate init error to callback', (done) => {
      storage.__set__('sqlite3', makeSqlite3({ code: 'SQLITE_CANTOPEN' }));
      storage.storage_fns.query(
        { type: 'keys', column: 'id', data: 'hostname' },
        (err) => {
          expect(err).to.be.an('error');
          done();
        },
      );
    });
  });

  // ─── clear ──────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('should execute DELETE FROM table and call back without error', (done) => {
      storage.storage_fns.clear({ type: 'keys' }, (err) => {
        expect(err).to.be.null;
        // run call #1 = CREATE TABLE, call #2 = DELETE FROM keys
        expect(dbInstance.run.callCount).to.equal(2);
        expect(dbInstance.run.secondCall.args[0]).to.match(/DELETE FROM keys/);
        expect(dbInstance.close.called).to.be.true;
        done();
      });
    });

    it('should return SQLITE_ACCESS_ERR when clear fails with SQLITE_READONLY', (done) => {
      storage.storage_fns.clear({ type: 'keys' }, (err) => {
        expect(err).to.equal(SQLITE_ACCESS_ERR);
        done();
      });
      dbInstance.run.onSecondCall().callsFake((sql, c) => c({ code: 'SQLITE_READONLY' }));
    });

    it('should propagate init error to callback', (done) => {
      storage.__set__('sqlite3', makeSqlite3({ code: 'SQLITE_CANTOPEN' }));
      storage.storage_fns.clear({ type: 'keys' }, (err) => {
        expect(err).to.be.an('error');
        done();
      });
    });
  });
});

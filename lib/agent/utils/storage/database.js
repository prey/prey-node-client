// @ts-check
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const { exec } = require('child_process');

const createDatabase = (dbPath, cb) => {
  // eslint-disable-next-line consistent-return
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return cb(err);
    cb(null, db);
  });
};

const backupDatabase = (db, path, cb) => {
  const backupPreyDb = db.backup(path);
  cb(backupPreyDb);
};

const stepDatabase = (db, cb) => {
  // eslint-disable-next-line consistent-return
  db.step(-1, (err) => {
    if (err) return cb(new Error(err));
    cb(null);
  });
};

const closeDatabase = (db, backupTempDB, cb) => {
  // eslint-disable-next-line consistent-return
  db.finish((errFinished) => {
    if (errFinished) return cb(new Error(errFinished));
    // eslint-disable-next-line consistent-return
    backupTempDB.close((err) => {
      if (err) return cb(err);
      cb(null);
    });
  });
};

const deleteDatabase = (backupDBPath, cb) => {
  exec(`del /f ${backupDBPath}`, (errDelete, _stdout, stderr) => cb(errDelete, stderr));
};

/**
 * Opens a database file and runs `PRAGMA integrity_check` to confirm it is a valid,
 * non-corrupt SQLite file. Used to verify a freshly copied DB before trusting it.
 *
 * @param {string} dbPath - Path to the database file to verify.
 * @param {(err: Error|null) => void} cb - Called with null on success, or an Error.
 * @returns {void}
 */
const verifyDatabase = (dbPath, cb) => {
  let db = null;
  try {
    db = new sqlite3.Database(dbPath, (openErr) => {
      if (openErr) { cb(openErr); return; }
      db.get('PRAGMA integrity_check', (err, row) => {
        const result = row && row.integrity_check;
        db.close(() => {
          if (err) { cb(err); return; }
          if (result !== 'ok') { cb(new Error(`integrity_check failed: ${result}`)); return; }
          cb(null);
        });
      });
    });
  } catch (e) {
    const done = () => cb(e instanceof Error ? e : new Error(String(e)));
    if (db) db.close(done);
    else done();
  }
};

const dbToJson = async (dbPath) => {
  let dbConn = null;
  try {
    dbConn = new sqlite3.Database(dbPath);
    const dbAll = promisify(dbConn.all.bind(dbConn));
    const tables = await dbAll('SELECT name FROM sqlite_master WHERE type="table" AND name NOT LIKE "sqlite_%";');
    if (tables.length === 0) return 'No tables found in the database.';
    const databaseData = {};
    const tableDataPromises = tables.map(async ({ name }) => {
      const rows = await dbAll(`SELECT * FROM ${name};`);
      databaseData[name] = rows;
    });
    await Promise.all(tableDataPromises);
    return databaseData;
  } catch (errorVacuum) {
    return errorVacuum;
  } finally {
    if (dbConn) {
      await new Promise((resolve, reject) => {
        dbConn.close((errClose) => {
          if (errClose) return reject(errClose);
          return resolve(undefined);
        });
      });
    }
  }
};

module.exports = {
  createDatabase,
  backupDatabase,
  stepDatabase,
  closeDatabase,
  deleteDatabase,
  verifyDatabase,
  dbToJson,
};

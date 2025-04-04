const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
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

const dbToJson = async (dbPath) => {
  let dbConn = null;
  try {
    dbConn = new sqlite3.Database(dbPath);
    const dbAll = promisify(dbConn.all.bind(dbConn));
    const tables = await dbAll(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`);
    if (tables.length === 0) return 'No tables found in the database.';
    const databaseData = {};
    for (const { name } of tables) {
      const rows = await dbAll(`SELECT * FROM ${name};`);
      databaseData[name] = rows;
    }
    return databaseData;
  } catch (errorVacuum) {
    return errorVacuum;
  } finally {
    if (dbConn) {
      dbConn.close((errClose) => {
        if (errClose) return errClose;
        return null;
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
  dbToJson,
};

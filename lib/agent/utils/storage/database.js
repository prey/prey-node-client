const sqlite3 = require('sqlite3').verbose();
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

module.exports = {
  createDatabase,
  backupDatabase,
  stepDatabase,
  closeDatabase,
  deleteDatabase,
};

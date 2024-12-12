const sqlite3 = require('sqlite3').verbose();

const createDatabase = (dbPath, cb) => {
  // eslint-disable-next-line consistent-return
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return cb(err);
    cb(null, db);
  });
};

const backupDatabase = (db, cb) => {
  db.serialize(() => {
    db.backup(cb);
  });
};

const closeDatabase = (db, cb) => {
  // eslint-disable-next-line consistent-return
  db.close((err) => {
    if (err) return cb(err);
    cb(null);
  });
};

module.exports = {
  createDatabase,
  backupDatabase,
  closeDatabase,
};

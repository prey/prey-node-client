const fs = require('fs');
const { join } = require('path');
const sqlite3 = require('sqlite3').verbose();
const { paths } = require('../../../common').system;
const { storageConst, osConst } = require('../../../constants');

exports.osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const dbPath = join(paths.config, 'commands.db');
const backupDBPath = join(paths.temp, 'prey', 'commands.db');

exports.verifyTempDatabase = () => fs.existsSync(backupDBPath);

exports.database = require('./database');

const nameToSearchRestored = 'restored';
const nameToSearchFenixReady = 'fenixReady';

const addCheckDataToTempDB = (cb) => {
  const db = new sqlite3.Database(backupDBPath);
  const query = 'INSERT INTO keys (id, value) VALUES (?, ?)';
  db.run(query, [nameToSearchRestored, 'true'], () => {
    db.close(() => {
      if (cb) cb();
    });
  });
};
// eslint-disable-next-line consistent-return
const stepDatabaseReact = (backupPreyDb, backupTempDB, err, cb) => {
  if (err) return cb(err);

  // eslint-disable-next-line consistent-return
  exports.database.closeDatabase(backupPreyDb, backupTempDB, (errClosing) => {
    if (errClosing) {
      return cb(new Error(`${storageConst.BACKUP.CLOSING_ERROR}: ${errClosing}`));
    }
    addCheckDataToTempDB(() => {
      exports.database.deleteDatabase(backupDBPath, (errDelete, stderr) => {
        if (errDelete || stderr) return cb(new Error(`${storageConst.BACKUP.DELETING_ERROR}: ${errDelete || stderr}`));
        return cb(null, `${storageConst.BACKUP.RESTORE_SUCCESS}`);
      });
    });
  });
};

const databaseBackUpReact = (backupTempDB, backupPreyDb, cb) => {
  exports.database.stepDatabase(backupPreyDb, (err) => {
    stepDatabaseReact(backupPreyDb, backupTempDB, err, cb);
  });
};

const checkDataInTempDB = (whatToSearch, cb) => {
  const db = new sqlite3.Database(backupDBPath);
  const query = 'SELECT * FROM keys WHERE id = ?';
  db.get(query, [whatToSearch], (err, row) => {
    let found = false;
    if (!err && row) {
      found = true;
    }
    db.close(() => {
      cb(found);
    });
  });
};

// eslint-disable-next-line consistent-return
const databaseCreateReact = (err, backupTempDB, cb) => {
  if (err) {
    return cb(new Error(storageConst.SQLITE_ACCESS_ERR));
  }

  exports.database.backupDatabase(backupTempDB, dbPath, (backupPreyDb) => {
    databaseBackUpReact(backupTempDB, backupPreyDb, cb);
  });
};

/**
 * Restores the database from a backup.
 *
 * @param {function} cb - The callback function to be called after the restore is complete.
 * @return {undefined} The callback function is called with either an error or a success message.
 */
// eslint-disable-next-line consistent-return
exports.restore = (cb) => {
  try {
    if (exports.osName !== 'windows') return cb(`${storageConst.TITLE}: ${osConst.RESTRICTION.ONLY_WINDOWS}`);
    if (!exports.verifyTempDatabase()) return cb();
    // eslint-disable-next-line consistent-return
    checkDataInTempDB(nameToSearchFenixReady, (foundFenix) => {
      if (!foundFenix) return cb();
      // eslint-disable-next-line consistent-return
      checkDataInTempDB(nameToSearchRestored, (foundRestored) => {
        if (foundRestored) return cb();
        try {
          exports.database.createDatabase(backupDBPath, (err, backupTempDB) => {
            databaseCreateReact(err, backupTempDB, () => {
              fs.unlink(backupDBPath, () => {
                cb();
              });
            });
          });
        } catch (errorCreate) {
          return cb(new Error(errorCreate));
        }
      });
    });
  } catch (errorRestore) {
    cb(new Error(errorRestore));
  }
};

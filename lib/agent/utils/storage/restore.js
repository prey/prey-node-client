const fs = require('fs');
const { join } = require('path');
const { exec } = require('child_process');
const { paths } = require('../../../common').system;
const { storageConst, osConst } = require('../../../constants');

exports.osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const backupDBPath = join(paths.temp, 'prey', 'commands.db');
exports.execCmd = (cmd, cb) => {
  exec(cmd, (errDelete, _stdout, stderr) => {
    cb(errDelete, _stdout, stderr);
  });
};
exports.verifyTempDatabase = () => fs.existsSync(backupDBPath);

exports.database = require('./database');

// eslint-disable-next-line consistent-return
const databaseCreateReact = (err, backupTempDB, cb) => {
  if (err) {
    return cb(new Error(storageConst.SQLITE_ACCESS_ERR));
  }
  // eslint-disable-next-line consistent-return
  exports.database.backupDatabase(backupTempDB, (errBackupDatabase) => {
    if (errBackupDatabase) {
      return cb(new Error(errBackupDatabase));
    }
    // eslint-disable-next-line consistent-return
    exports.database.closeDatabase(backupTempDB, (errClose) => {
      if (errClose) {
        return cb(new Error(`${storageConst.BACKUP.CLOSING_ERROR}: ${errClose.message}`));
      }
      // eslint-disable-next-line consistent-return
      exports.execCmd(`del /f ${backupDBPath}`, (errDelete, _stdout, stderr) => {
        if (errDelete || stderr) {
          return cb(new Error(`${storageConst.BACKUP.DELETING_ERROR}: ${errDelete.message || stderr}`));
        }
        cb(`${storageConst.BACKUP.RESTORE_SUCCESS}`);
      });
    });
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
    exports.database.createDatabase(backupDBPath, (err, backupTempDB) => {
      databaseCreateReact(err, backupTempDB, cb);
    });
  } catch (errorRestore) {
    cb(new Error(errorRestore));
  }
};

const fs = require('fs');
const { join } = require('path');
const { exec } = require('child_process');
const sqlite3 = require('sqlite3');

const { paths } = require('../../../system');
const { storageConst, osConst } = require('../../../constants');

const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const dbPath = join(paths.config, 'commands.db');
const backupDBPath = join(paths.temp, 'prey', 'commands.db');

const verifyTempDatabase = () => fs.existsSync(backupDBPath);
/**
 * Restores the database from a backup.
 *
 * @param {function} cb - The callback function to be called after the restore is complete.
 * @return {undefined} The callback function is called with either an error or a success message.
 */
// eslint-disable-next-line consistent-return
const restore = (cb) => {
  try {
    if (osName !== 'windows') return cb(`${storageConst.TITLE}: ${osConst.RESTRICTION.ONLY_WINDOWS}`);
    if (!verifyTempDatabase()) return cb();
    // eslint-disable-next-line consistent-return
    const backupTempDB = new sqlite3.Database(backupDBPath, (errorCreation) => {
      if (errorCreation) return cb(new Error(storageConst.SQLITE_ACCESS_ERR));
      const backupPreyDb = backupTempDB.backup(dbPath);
      // eslint-disable-next-line consistent-return
      backupPreyDb.step(-1, (err) => {
        if (err) return cb(new Error(err));
        // eslint-disable-next-line consistent-return
        backupPreyDb.finish((errFinished) => {
          if (errFinished) return cb(new Error(errFinished));
          // eslint-disable-next-line consistent-return
          backupTempDB.close((errClosing) => {
            if (errClosing) return cb(`${storageConst.BACKUP.CLOSING_ERROR}: ${errClosing}`);
            exec(`del /f ${backupDBPath}`, (errDelete, _stdout, stderr) => {
              if (errDelete || stderr) return cb(`${storageConst.BACKUP.DELETING_ERROR}: ${errDelete || stderr}`);
              return cb(`${storageConst.BACKUP.RESTORE_SUCCESS}`);
            });
          });
        });
      });
    });
  } catch (errorRestore) {
    cb(new Error(errorRestore));
  }
};

exports.restore = restore;

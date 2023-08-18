const fs = require('fs');
const { join } = require('path');
const sqlite3 = require('sqlite3');
const { paths } = require('../../../common').system;
const { storageConst } = require('../../../constants');

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
    if (osName !== 'windows') return cb('Restore only for windows.');
    if (!verifyTempDatabase()) return cb();
    // eslint-disable-next-line consistent-return
    const commandsDB = new sqlite3.Database(backupDBPath, (errorCreation) => {
      if (errorCreation) return cb(new Error(storageConst.SQLITE_ACCESS_ERR));
      const backup = commandsDB.backup(dbPath);
      // eslint-disable-next-line consistent-return
      backup.step(-1, (err) => {
        if (err) return cb(new Error(err));
        // eslint-disable-next-line consistent-return
        backup.finish((errFinished) => {
          if (errFinished) return cb(new Error(errFinished));
          return cb('Restore successfully');
        });
      });
    });
  } catch (errorRestore) {
    cb(new Error(errorRestore));
  }
};

exports.restore = restore;

// @ts-check
const fs = require('fs');
const path = require('path');
const async = require('async');
const shared = require('./shared');
const common = require('../common');
const database = require('../agent/utils/storage/database');

const { join } = path;
const { paths } = common.system;

const DB_FILE = 'commands.db';
// Plain files copied as-is. The DB is handled separately via the sqlite backup API.
const PLAIN_FILES = ['prey.conf', 'prey.log', 'prey_restarts.log'];
// Rotated log files produced by the logger (prey.log.1.gz ... prey.log.9.gz).
const ROTATED_LOG_RE = /^prey\.log\.\d+\.gz$/i;

/**
 * Legacy Windows config dir that older installations use by default.
 * Same expression used by lib/conf/tasks/os/windows.js for cleanup.
 * @returns {string}
 */
const legacyDir = () => join(process.env.WINDIR || String.raw`C:\Windows`, 'Prey');

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean} true when both resolve to the same path (case-insensitive, Windows).
 */
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

/**
 * Copies the SQLite database using the sqlite3 online backup API so it is safe
 * to run even while the agent holds the DB open. Mirrors the sequence used by
 * lib/agent/utils/storage/restore.js.
 *
 * @param {string} src
 * @param {string} dest
 * @param {(err?: Error) => void} cb
 * @returns {void}
 */
const copyDatabase = (src, dest, cb) => {
  database.createDatabase(src, (err, sourceDb) => {
    if (err) { cb(err); return; }
    try {
      database.backupDatabase(sourceDb, dest, (backupHandle) => {
        database.stepDatabase(backupHandle, (stepErr) => {
          database.closeDatabase(backupHandle, sourceDb, (closeErr) => {
            cb(stepErr || closeErr || undefined);
          });
        });
      });
    } catch (e) {
      sourceDb.close(() => cb(e instanceof Error ? e : new Error(String(e))));
    }
  });
};

/**
 * Builds the list of Prey data files present in `dir` that should be migrated.
 * @param {string} dir
 * @returns {string[]}
 */
const filesToMigrate = (dir) => {
  let candidates = [DB_FILE, ...PLAIN_FILES];
  try {
    const entries = fs.readdirSync(dir);
    candidates = candidates.concat(entries.filter((f) => ROTATED_LOG_RE.test(f)));
  } catch (e) {
    // readdir failed: fall back to the known fixed names.
  }
  return candidates
    .filter((f, i, arr) => arr.indexOf(f) === i)
    .filter((f) => fs.existsSync(join(dir, f)));
};

/**
 * Copies one file from the legacy dir into the target dir. The DB uses the
 * sqlite backup API; everything else is a plain file copy.
 * @param {string} src
 * @param {string} target
 * @param {string} file
 * @param {(err?: Error) => void} next
 * @returns {void}
 */
const copyOne = (src, target, file, next) => {
  const srcPath = join(src, file);
  const destPath = join(target, file);
  if (file === DB_FILE) { copyDatabase(srcPath, destPath, next); return; }
  fs.copyFile(srcPath, destPath, next);
};

/**
 * Verifies the freshly copied database at the target, and removes it if it fails so a
 * corrupt copy is never left behind (the conditional install-anchoring keys on the
 * presence of commands.db, so a bad copy there would be adopted on the next boot).
 * No-op when the DB was not among the migrated files.
 *
 * @param {string} target
 * @param {string[]} migrated - files that were copied.
 * @param {(err?: Error) => void} next
 * @returns {void}
 */
const verifyCopiedDatabase = (target, migrated, next) => {
  if (!migrated.includes(DB_FILE)) { next(); return; }
  const destDb = join(target, DB_FILE);
  database.verifyDatabase(destDb, (err) => {
    if (!err) { next(); return; }
    // Drop the invalid copy so it is not picked up as authoritative later.
    fs.rm(destDb, { force: true }, () => next(err));
  });
};

/**
 * Migrates Prey data files (commands.db, prey.conf, prey.log, prey_restarts.log
 * and rotated logs) from the legacy config dir (%WINDIR%\Prey) into the current
 * install dir, so an installation moved to a custom location keeps its data.
 *
 * Strategy: copy-only. Files are copied into the install dir and the originals are
 * left untouched in the legacy dir. This keeps a downgrade to a pre-anchoring version
 * safe (it still finds its data in %WINDIR%\Prey), and avoids divergence because the
 * agent only adopts the install-dir copy once commands.db is present there (see the
 * conditional anchoring in lib/system/paths.js). The copied DB is verified before the
 * migration is reported as successful. Windows only.
 *
 * @param {object} values - CLI values (unused).
 * @param {(err: Error|null, msg?: string) => void} [cb]
 * @returns {void}
 */
exports.files = (values, cb) => {
  const done = typeof cb === 'function' ? cb : () => {};

  if (process.platform !== 'win32') {
    shared.log('Only available on Windows');
    done(null, 'Only available on Windows');
    return;
  }

  const src = legacyDir();
  const target = paths && paths.install;

  if (!src || !target) { done(new Error('Could not resolve source/target directories')); return; }

  if (samePath(src, target)) {
    shared.log('Nothing to migrate: install dir matches the legacy config dir.');
    done(null, 'Nothing to migrate');
    return;
  }

  if (!fs.existsSync(src)) {
    shared.log(`Legacy config dir not found: ${src}`);
    done(null, 'Nothing to migrate');
    return;
  }

  const toMigrate = filesToMigrate(src);
  if (toMigrate.length === 0) {
    shared.log(`No Prey data files found in ${src}`);
    done(null, 'Nothing to migrate');
    return;
  }

  fs.mkdir(target, { recursive: true }, (mkErr) => {
    if (mkErr) { done(mkErr); return; }

    shared.log(`Migrating ${toMigrate.length} file(s) from ${src} to ${target}`);
    async.eachSeries(
      toMigrate,
      (file, next) => copyOne(src, target, file, next),
      (copyErr) => {
        // Abort without touching originals so nothing is left half-done.
        if (copyErr) { done(copyErr); return; }

        // Verify the copied DB before declaring success. Originals are left in place
        // (copy-only), so a failure here is safe: the legacy data is still authoritative.
        verifyCopiedDatabase(target, toMigrate, (verifyErr) => {
          if (verifyErr) { done(verifyErr); return; }
          const msg = `Migrated ${toMigrate.length} file(s) to ${target}`;
          shared.log(msg);
          done(null, msg);
        });
      },
    );
  });
};

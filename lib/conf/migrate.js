// @ts-check
const fs = require('fs');
const path = require('path');
const async = require('async');
const shared = require('./shared');
const common = require('../common');
const database = require('../agent/utils/storage/database');
const pidfile = require('../agent/utils/pidfile');

const { join } = path;
const { paths } = common.system;

const DB_FILE = 'commands.db';
// Plain files copied as-is. The DB is handled separately via the sqlite backup API.
const PLAIN_FILES = ['prey.conf', 'prey.log', 'prey_restarts.log'];
// Rotated log files produced by the logger (prey.log.1.gz ... prey.log.9.gz).
const ROTATED_LOG_RE = /^prey\.log\.\d+\.gz$/i;
// Files that carry the device identity/state. If either already exists in the target, a
// migration would overwrite live data with the (possibly older) legacy copy.
const IDENTITY_FILES = [DB_FILE, 'prey.conf'];
// Suffix for target files moved aside before a forced migration (restored on failure).
const BACKUP_SUFFIX = '.pre-migrate';

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
 * commands.db goes LAST: the install-root anchoring in lib/system/paths.js keys on its
 * presence, so it must only land in the target once everything else is already there.
 * @param {string} dir
 * @returns {string[]}
 */
const filesToMigrate = (dir) => {
  let candidates = [...PLAIN_FILES];
  try {
    const entries = fs.readdirSync(dir);
    candidates = candidates.concat(entries.filter((f) => ROTATED_LOG_RE.test(f)));
  } catch (e) {
    // readdir failed: fall back to the known fixed names.
  }
  candidates.push(DB_FILE);
  return candidates
    .filter((f, i, arr) => arr.indexOf(f) === i)
    .filter((f) => fs.existsSync(join(dir, f)));
};

/**
 * Calls back with true when the Prey agent process recorded in the pidfile is alive.
 * Any read failure (no pidfile, stale pid / ESRCH, unparsable pid) means "not running".
 * @param {(running: boolean) => void} cb
 * @returns {void}
 */
const isAgentRunning = (cb) => {
  try {
    pidfile.read(common.pid_file, (err, running) => {
      cb(!err && !!running);
    });
  } catch (e) {
    cb(false);
  }
};

/**
 * Removes the given files from `dir`, ignoring individual failures (best-effort cleanup).
 * @param {string} dir
 * @param {string[]} files
 * @param {() => void} cb
 * @returns {void}
 */
const removeFiles = (dir, files, cb) => {
  async.eachSeries(
    files,
    (file, next) => fs.rm(join(dir, file), { force: true }, () => next()),
    () => cb(),
  );
};

/**
 * Renames each file in `dir` from `from(file)` to `to(file)`, stopping at the first error.
 * @param {string} dir
 * @param {string[]} files
 * @param {(file: string) => string} from
 * @param {(file: string) => string} to
 * @param {(err: Error|null) => void} cb
 * @returns {void}
 */
const renameFiles = (dir, files, from, to, cb) => {
  async.eachSeries(
    files,
    (file, next) => fs.rename(join(dir, from(file)), join(dir, to(file)), (err) => next(err)),
    (err) => cb(err || null),
  );
};

/**
 * Undoes a failed migration: removes every file this run created in the target and moves
 * the pre-existing target files back into place, so the target is left as it was found.
 * @param {string} target
 * @param {string[]} created - files written (fully or partially) by this run.
 * @param {string[]} backedUp - pre-existing target files moved aside with BACKUP_SUFFIX.
 * @param {() => void} cb
 * @returns {void}
 */
const rollback = (target, created, backedUp, cb) => {
  removeFiles(target, created, () => {
    renameFiles(target, backedUp, (f) => f + BACKUP_SUFFIX, (f) => f, (err) => {
      if (err) shared.log(`Warning: could not restore ${target} files from *${BACKUP_SUFFIX}: ${err.message}`);
      cb();
    });
  });
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
 * Migrates Prey data files (prey.conf, prey.log, prey_restarts.log, rotated logs and,
 * last, commands.db) from the legacy config dir (%WINDIR%\Prey) into the current install
 * dir, so an installation moved to a custom location keeps its data.
 *
 * Strategy: copy-only. Files are copied into the install dir and the originals are
 * left untouched in the legacy dir. This keeps a downgrade to a pre-anchoring version
 * safe (it still finds its data in %WINDIR%\Prey), and avoids divergence because the
 * agent only adopts the install-dir copy once commands.db is present there (see the
 * conditional anchoring in lib/system/paths.js). The copied DB is verified before the
 * migration is reported as successful. Windows only.
 *
 * Safety rules:
 * - Refuses while the agent is running: the running agent would switch to the copied DB
 *   mid-flight while its config and logs keep going to the legacy dir until a restart.
 * - Refuses when the target already holds commands.db or prey.conf (live data), unless
 *   `-f/--force` is passed. Pre-existing target files are then moved aside with the
 *   `.pre-migrate` suffix instead of being overwritten.
 * - All-or-nothing: on any failure every file this run wrote to the target is removed
 *   and the moved-aside files are restored.
 *
 * @param {Record<string, *>} values - CLI values; `values['-f'] === true` forces the run.
 * @param {(err: Error|null, msg?: string) => void} [cb]
 * @returns {void}
 */
exports.files = (values, cb) => {
  const done = typeof cb === 'function' ? cb : () => {};
  const force = !!values && values['-f'] === true;

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

  isAgentRunning((running) => {
    if (running) {
      done(new Error('The Prey agent is running. Stop the Prey service (CronService) before migrating files, then start it again.'));
      return;
    }

    const identityInTarget = IDENTITY_FILES.filter((f) => fs.existsSync(join(target, f)));
    if (identityInTarget.length > 0 && !force) {
      done(new Error(`${target} already contains ${identityInTarget.join(', ')}. `
        + 'Migrating would overwrite that data with the legacy copy. Use -f/--force to proceed anyway.'));
      return;
    }

    fs.mkdir(target, { recursive: true }, (mkErr) => {
      if (mkErr) { done(mkErr); return; }

      // Move pre-existing target files aside instead of overwriting them.
      const backedUp = toMigrate.filter((f) => fs.existsSync(join(target, f)));
      renameFiles(target, backedUp, (f) => f, (f) => f + BACKUP_SUFFIX, (bakErr) => {
        if (bakErr) {
          // Put back whatever was already moved aside before the failure.
          const moved = backedUp.filter((f) => fs.existsSync(join(target, f + BACKUP_SUFFIX)));
          rollback(target, [], moved, () => done(bakErr));
          return;
        }
        if (backedUp.length > 0) shared.log(`Moved existing ${backedUp.join(', ')} aside (*${BACKUP_SUFFIX})`);

        /** @type {string[]} */
        const created = [];
        shared.log(`Migrating ${toMigrate.length} file(s) from ${src} to ${target}`);
        async.eachSeries(
          toMigrate,
          (file, next) => {
            // Tracked before copying, so a partially written file is cleaned up too.
            created.push(file);
            copyOne(src, target, file, next);
          },
          (copyErr) => {
            if (copyErr) {
              rollback(target, created, backedUp, () => done(copyErr));
              return;
            }

            // Verify the copied DB before declaring success. Originals are left in place
            // (copy-only), so a failure here is safe: the legacy data is still authoritative.
            verifyCopiedDatabase(target, toMigrate, (verifyErr) => {
              if (verifyErr) {
                rollback(target, created, backedUp, () => done(verifyErr));
                return;
              }
              const msg = `Migrated ${toMigrate.length} file(s) to ${target}`;
              shared.log(msg);
              done(null, msg);
            });
          },
        );
      });
    });
  });
};

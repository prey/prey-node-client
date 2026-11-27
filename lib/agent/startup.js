// @ts-check
const { join } = require('path');
const fs = require('fs');

const rootPath = process.env.ROOT_PATH || join(__dirname, '..', '..');

const configFileName = 'prey.conf';
const defaultConfigFilePath = join(rootPath, `${configFileName}.default`);
const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
// Use the resolved paths (with the conditional Windows anchoring) rather than the raw
// per-OS defaults, so the config/db dir we create here is exactly the one the running
// agent reads from. Using the raw defaults could create prey.conf in a different dir
// than the agent later looks in (e.g. on a custom install).
const systemPaths = require('../system/paths');

const configFilePath = join(systemPaths.config, `${configFileName}`);

/**
 * Best-effort log through the agent logger. Never throws (logging must not block boot).
 * @param {'info'|'warn'} level
 * @param {string} line
 * @returns {void}
 */
const logLine = (level, line) => {
  try {
    // eslint-disable-next-line global-require
    const common = /** @type {any} */ (require('./common'));
    const logger = common && common.logger;
    if (logger && typeof logger[level] === 'function') logger[level](line);
  } catch (e) {
    // logging is best-effort; ignore any failure here.
  }
};

/**
 * Logs which config dir is in use and why, so a fallback to the legacy default dir
 * is observable instead of silent.
 * @returns {void}
 */
const logConfigSource = () => {
  logLine('info', `config dir: ${systemPaths.config} `
    + `(source: ${systemPaths.config_source}, managed: ${systemPaths.managed})`);
};

/**
 * Creates prey.conf from the bundled default when it does not exist yet, setting up
 * the prey user/permissions on Unix.
 * @param {(err?: Error|null) => void} cb
 * @returns {void}
 */
const ensurePreyConf = (cb) => {
  const exists = fs.existsSync(configFilePath);
  if (exists) return cb();
  return fs.copyFile(defaultConfigFilePath, configFilePath, (err) => {
    if (err) return cb(err);
    if (osName === 'windows') {
      return cb();
    }
    // eslint-disable-next-line global-require, camelcase
    const { setup_permissions, create_user } = require('../conf/tasks/prey_user');
    return create_user(() => {
      setup_permissions(cb);
    });
  });
};

/**
 * Initializes the storage (creating commands.db), applies any pending schema
 * migrations, and then ensures prey.conf exists.
 * @param {(err?: Error|null) => void} cb
 * @returns {void}
 */
const ensureDb = (cb) => {
  // eslint-disable-next-line global-require
  const storage = require('./utils/storage');
  // Opening the DB creates commands.db if missing. The connection is only needed
  // for that, so close it right away: left open, it outlives the whole conf CLI run.
  storage.init(null, null, (err, db) => {
    // Best-effort: keep going, but leave a trace (e.g. SQLITE_CANTOPEN while an
    // antivirus holds the file) instead of failing silently.
    if (err) logLine('warn', `Unable to open commands.db: ${err.message}`);
    const migrate = () => {
      // Apply any pending schema migrations once the DB file exists. Best-effort:
      // a migration failure must not block boot, so we proceed regardless.
      storage.migrateSchema(() => {
        ensurePreyConf(cb);
      });
    };
    if (db) return db.close(() => migrate());
    return migrate();
  });
};

/**
 * Ensures the config/db directory exists (creating it if needed) and then the DB
 * and prey.conf are in place.
 * @param {(err?: Error|null) => void} cb
 * @returns {void}
 */
const ensureAndCreateDb = (cb) => {
  logConfigSource();
  const exists = fs.existsSync(systemPaths.config);
  if (exists) return ensureDb(cb);
  return fs.mkdir(systemPaths.config, { recursive: true }, (err) => {
    if (err) return cb(err);
    return ensureDb(cb);
  });
};

exports.ensureAndCreateDb = ensureAndCreateDb;

// @ts-check
const fs = require('fs');
const async = require('async');
const { join } = require('path');
const sqlite3 = require('sqlite3').verbose();
// logger  = require('../common').logger.prefix('storage'),
// @ts-ignore — system/paths builds `config`/`install` dynamically at runtime
const { config, install } = require('../../system/paths');

let storagePath;
const singular = (type) => type.substring(0, type.length - 1);
/**
 * Escapes a value for a single-quoted SQL literal ('' is SQL's escape for '), so it
 * round-trips unchanged instead of ending the literal early.
 * @param {any} v
 * @returns {string}
 */
const sqlStr = (v) => String(v).replace(/'/g, "''");
const types = {
  commands: {
    schema:
      'id TEXT PRIMARY KEY, command TEXT, target TEXT, options TEXT, started_resp INTEGER, started INTEGER, stopped_resp INTEGER, stopped INTEGER',
    keys: ['id', 'command', 'target', 'options', 'started_resp', 'started', 'stopped_resp', 'stopped'],
    values: (data) => `'${data.id}', '${data.command}', '${data.target}', '${JSON.stringify(
      data.options,
    ).replace(/'/g, '')}' , 0, 'NULL', 0, 'NULL'`,
  },
  responses: {
    schema: 'id TEXT PRIMARY KEY, action_id TEXT, opts TEXT, out TEXT, error TEXT, status TEXT, action TEXT, time INTEGER, retries INTEGER',
    keys: ['id', 'action_id', 'opts', 'out', 'error', 'status', 'action', 'time', 'retries'],
    values: (data) => `'${data.id}', '${data.action_id}', '${data.opts}', '${data.out}', '${data.error}', '${data.status}', '${data.action}' , '${data.time}', 0`,
  },
  // Durable queue for a pending missing/recover state change that could not be
  // reported to the control panel (e.g. no connection when an automation fired).
  // Single row keyed id='current': the latest intent replaces the previous one.
  device_state: {
    schema: 'id TEXT PRIMARY KEY, missing INTEGER, confirmed INTEGER, time INTEGER, retries INTEGER',
    keys: ['id', 'missing', 'confirmed', 'time', 'retries'],
    values: (data) => `'${data.id}', '${data.missing}', '${data.confirmed}', '${data.time}', '${data.retries || 0}'`,
  },
  files: {
    schema: 'id TEXT PRIMARY KEY, name TEXT, path TEXT, size TEXT, user TEXT, attempt INTEGER, resumable INTEGER',
    keys: ['id', 'name', 'path', 'size', 'user', 'attempt', 'resumable'],
    values: (data) => `'${data.id}', '${data.name}', '${data.path}', '${data.size}', '${data.user}', 0, 0`,
  },
  triggers: {
    schema:
      'id TEXT PRIMARY KEY, name TEXT, persist INTEGER, synced_at INTEGER, last_exec INTEGER, automation_events TEXT, automation_actions TEXT',
    keys: ['id', 'name', 'persist', 'synced_at', 'last_exec', 'automation_events', 'automation_actions'],
    values: (data) => `'${data.id}', '${data.name}', '${data.persist}', '${data.synced_at}', '${
      data.last_exec
    }', '${JSON.stringify(data.automation_events).replace(/'/g, '')}', '${JSON.stringify(data.automation_actions).replace(/'/g, '')}'`,
  },
  keys: {
    schema: 'id TEXT PRIMARY KEY, value TEXT',
    keys: ['id', 'value'],
    // Values are often JSON or error text holding quotes: escape them, since a raw
    // `'` (or `'--`) would break the statement or rewrite other rows.
    values: (data) => `'${sqlStr(data.id)}', '${sqlStr(data.value)}'`,
  },
  // Dedicated, timestamped audit log of the locations the agent computed and
  // whether/when they were reported to the control panel. Multi-row (one per
  // accepted location, keyed by a uuid), ordered by recorded_at. Separate from
  // the geo orchestrator's functional state kept in `keys`.
  locations: {
    schema: 'id TEXT PRIMARY KEY, lat REAL, lng REAL, accuracy REAL, method TEXT, '
      + 'source TEXT, recorded_at TEXT, sent INTEGER, send_type TEXT, delta REAL',
    keys: ['id', 'lat', 'lng', 'accuracy', 'method', 'source', 'recorded_at', 'sent', 'send_type', 'delta'],
    // Null-safe builder: numeric columns emit the number or the SQL NULL keyword
    // (accuracy/delta are often absent), text columns are quoted with single
    // quotes stripped to avoid breaking the raw interpolation.
    values: (data) => {
      const num = (v) => (Number.isFinite(v) ? v : 'NULL');
      const txt = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, '')}'`);
      return `'${data.id}', ${num(data.lat)}, ${num(data.lng)}, ${num(data.accuracy)}, ${txt(data.method)}, ${txt(data.source)}, ${txt(data.recorded_at)}, ${data.sent ? 1 : 0}, ${txt(data.send_type)}, ${num(data.delta)}`;
    },
  },
  versions: {
    schema: 'id TEXT PRIMARY KEY, "from" TEXT, "to" TEXT, attempts INTEGER, notified INTEGER',
    keys: ['id', '"from"', '"to"', 'attempts', 'notified'],
    values: (data) => `'${data.id}', '${data.from}', '${data.to}','${data.attempts}','${data.notified}'`,
  },
};
const SQLITE_ACCESS_ERR = 'Access denied to commands database, must run agent as prey user';
exports.store_path = null;
const queries = {
  CREATE: (table) => `CREATE TABLE IF NOT EXISTS ${table} (${types[table].schema})`,
  INSERT: (table, data) => `INSERT INTO ${table} (${types[table].keys.join(', ')}) VALUES (${types[table].values(data)})`,
  UPSERT: (table, data) => `INSERT OR REPLACE INTO ${table} (${types[table].keys.join(', ')}) VALUES (${types[table].values(data)})`,
  DELETE: (table, id) => `DELETE FROM ${table} WHERE id = '${sqlStr(id)}'`,
  CLEAR: (table) => `DELETE FROM ${table}`,
  UPDATE: (table, id, changes) => `UPDATE ${table} SET ${changes} WHERE id = '${sqlStr(id)}'`,
  SELECT: (table) => `SELECT * FROM ${table}`,
  QUERY: (table, query) => `SELECT * FROM ${table} WHERE ${query}`,
};
const validateType = (type) => {
  const valid = Object.keys(types).indexOf(type) != -1;
  return valid;
};
// A task must always call back: with concurrency 1, one that never does blocks every
// later storage operation in this process.
const storage_queue = async.queue((task, cb) => {
  const fn = storage_fns[task.perform];
  if (typeof fn !== 'function') return cb(new Error(`Unknown storage operation: ${task.perform}`));
  try {
    return fn(task.opts, cb);
  } catch (e) {
    return cb(e);
  }
}, 1);
// All storage interaction goes through here...
exports.do = (perform, opts, cb) => {
  // Pause queue current execution
  storage_queue.pause();
  // Queue the new command
  storage_queue.push({ perform, opts }, cb);
  // Resume queue
  storage_queue.resume();
};
// Queue's callback...
// storage_queue.drain = function() {
//   console.log('Queue is Done!');
// };

// How long sqlite waits on a locked DB before failing, instead of erroring out
// immediately when another process (e.g. the migrate CLI) momentarily holds it.
const BUSY_TIMEOUT_MS = 3000;

// Target schema version. Bump this and add a migration entry below when a future
// release changes an EXISTING table (e.g. adds a column), now that the DB persists
// across upgrades. Fresh installs get the current schema via CREATE TABLE IF NOT
// EXISTS and are then stamped to this version.
const CURRENT_SCHEMA_VERSION = 1;

// Ordered schema migrations. Each entry { to, up(db, cb) } brings a pre-existing DB
// up to version `to`. Write them defensively (ignore "duplicate column"/"no such
// table"), because tables are created lazily per type. The v1 baseline needs none.
const migrations = [];

const dbExists = () => {
  if (fs.existsSync(join(install, 'commands.db'))) return install;
  return config;
};

// Single source of truth for the commands.db location, reused by other modules
// (e.g. log retrieval) so they never resolve a different file than the agent uses.
const dbPath = () => join(dbExists(), 'commands.db');

/**
 * Opens a new connection to commands.db and, when `type` is given, makes sure its
 * table exists. Each call owns its connection: the callback receives it and the
 * caller must close it. On error the connection is already closed.
 *
 * The connection is a local, never a shared module variable: callers such as
 * ensureAndCreateDb run outside the storage queue, so two opens can be in flight
 * at once and a shared handle would let one caller close the other's connection
 * (SQLITE_MISUSE: Database is closed).
 *
 * @param {string|null} type
 * @param {null} path - unused, kept for the public signature
 * @param {(err: Error|null, db?: any) => void} cb
 * @returns {void}
 */
const init = function (type, path, cb) {
  storagePath = dbPath();

  const db = new sqlite3.Database(storagePath, ((err) => {
    if (err) {
      if (/** @type {any} */ (err).code == 'SQLITE_CANTOPEN') return cb(new Error(SQLITE_ACCESS_ERR));
      return cb(err);
    }
    db.configure('busyTimeout', BUSY_TIMEOUT_MS);
    if (type) {
      if (!validateType(type)) return db.close(() => cb(new Error('Not an allowed type of key')));
      return db.run(queries.CREATE(type), (cErr) => {
        if (cErr) return db.close(() => cb(cErr));
        return cb(null, db);
      });
    }
    return cb(null, db);
  }));
};

/**
 * Applies pending schema migrations keyed on PRAGMA user_version, so a long-lived DB
 * (config/db now persist across upgrades) can gain columns on existing tables without
 * breaking inserts. Opens and closes its own connection. Call once at startup.
 *
 * @param {(err: Error|null) => void} [cb]
 * @returns {void}
 */
const migrateSchema = (cb) => {
  const done = typeof cb === 'function' ? cb : () => {};
  let db = null;
  try {
    db = new sqlite3.Database(dbPath(), (openErr) => {
      if (openErr) { done(openErr); return; }
      db.configure('busyTimeout', BUSY_TIMEOUT_MS);
      db.get('PRAGMA user_version', (getErr, row) => {
        if (getErr) { db.close(() => done(getErr)); return; }
        const version = (row && row.user_version) || 0;
        const pending = migrations.filter((m) => m.to > version);
        const applyNext = (i) => {
          if (i >= pending.length) {
            db.run(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`, (stampErr) => {
              db.close(() => done(stampErr || null));
            });
            return;
          }
          pending[i].up(db, (upErr) => {
            if (upErr) { db.close(() => done(upErr)); return; }
            applyNext(i + 1);
          });
        };
        applyNext(0);
      });
    });
  } catch (e) {
    const finish = () => done(e instanceof Error ? e : new Error(String(e)));
    if (db) db.close(finish);
    else finish();
  }
};
/**
 * Maps a SQLITE_READONLY error to the access-denied message shown to the user.
 * @param {any} err
 * @returns {any}
 */
const mapReadonly = (err) => (err && err.code == 'SQLITE_READONLY' ? SQLITE_ACCESS_ERR : err);

/**
 * Runs `work` on its own connection for `type` (opened through init()). Closes that
 * connection and calls `cb` exactly once, even if `work` throws: a task that never
 * calls back would block the storage queue (concurrency 1) for the rest of the
 * process, including the storage reads exceptions.send needs to report the crash.
 *
 * @param {string} type
 * @param {((err?: any, rows?: any) => void)|undefined} cb
 * @param {(db: any, done: (err?: any, rows?: any) => void) => void} work
 * @returns {void}
 */
const withDb = (type, cb, work) => {
  let finished = false;
  const finish = (...args) => {
    if (finished) return;
    finished = true;
    if (typeof cb === 'function') cb(...args);
  };
  init(type, null, (err, db) => {
    if (err) return finish(err);
    let closing = false;
    const done = (...args) => {
      if (closing) return;
      closing = true;
      db.close(() => finish(...args));
    };
    try {
      return work(db, done);
    } catch (e) {
      return done(e);
    }
  });
};

// Every storage_fns operation opens its own connection through withDb() and closes
// that same connection when it finishes.
var storage_fns = {};
/**
 * @param {{type: string, id?: string, data: any}} opts
 * @param {(err?: any) => void} [cb]
 */
storage_fns.set = (opts, cb) => withDb(opts.type, cb, (db, done) => {
  if (opts.id) opts.data.id = opts.id;
  db.run(queries.UPSERT(opts.type, opts.data), (err) => done(mapReadonly(err)));
});
/**
 * @param {{type: string, id: string}} opts
 * @param {(err?: any) => void} [cb]
 */
storage_fns.del = (opts, cb) => withDb(opts.type, cb, (db, done) => {
  db.run(queries.DELETE(opts.type, opts.id), (err) => done(mapReadonly(err)));
});
/**
 * @param {{type: string, id: string, columns: string|string[], values: any}} opts
 * @param {(err?: any) => void} [cb]
 */
storage_fns.update = (opts, cb) => withDb(opts.type, cb, (db, done) => {
  let changes;
  const { values } = opts;
  const { columns } = opts;
  if (Array.isArray(columns)) {
    const data = [];
    if (columns.length !== values.length || columns.length === 0) {
      return done(new Error(`Invalid update of ${opts.type}: columns and values must be non-empty and match`));
    }
    columns.forEach((el, index) => {
      const change = `${el} = '${sqlStr(values[index])}'`;
      data.push(change);
    });
    changes = data.join(', ');
  } else {
    changes = `${columns} = '${sqlStr(values)}'`;
  }
  return db.run(queries.UPDATE(opts.type, opts.id, changes), (err) => done(mapReadonly(err)));
});
/**
 * Calls back (err, null) on a SELECT error, or (err, []) when it is ENOENT.
 * @param {(err: any, rows?: any[]|null) => void} done
 * @returns {(err: any, rows: any[]) => void}
 */
const selectDone = (done) => (err, rows) => {
  if (err) return done(err, err.code !== 'ENOENT' ? null : []);
  return done(null, rows);
};
/**
 * @param {{type: string}} opts
 * @param {(err: any, rows?: any[]|null) => void} cb
 */
storage_fns.all = (opts, cb) => withDb(opts.type, cb, (db, done) => {
  db.all(queries.SELECT(opts.type), selectDone(done));
});
/**
 * @param {{type: string, column?: string, data?: any, query?: string}} opts
 * @param {(err: any, rows?: any[]|null) => void} cb
 */
storage_fns.query = (opts, cb) => withDb(opts.type, cb, (db, done) => {
  const { column } = opts;
  const { data } = opts;
  const query = `${column} = '${sqlStr(data)}'`;
  db.all(queries.QUERY(opts.type, opts.hasOwnProperty('query') ? opts.query : query), selectDone(done));
});
/**
 * @param {{type: string}} opts
 * @param {(err?: any) => void} [cb]
 */
storage_fns.clear = (opts, cb) => withDb(opts.type, cb, (db, done) => {
  db.run(queries.CLEAR(opts.type), (err) => done(mapReadonly(err)));
});
// Only for testing purposes
var erase = function (path, cb) {
  fs.unlink(path, (err) => {
    storagePath = null;
    cb && cb(err);
  });
};
exports.init = init;
exports.erase = erase;
exports.dbPath = dbPath;
exports.migrateSchema = migrateSchema;
module.exports.storage_fns = storage_fns;

const fs = require('fs');
const async = require('async');
const { join } = require('path');
const sqlite3 = require('sqlite3').verbose();
// logger  = require('../common').logger.prefix('storage'),
const { v4: uuidv4 } = require('uuid');
const { config, install } = require('../../system/paths');

let storagePath;
let backupPath;
let dbComm;
exports.first_init = true;
const singular = (type) => type.substring(0, type.length - 1);
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
    values: (data) => `'${data.id}', '${data.value}'`,
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
  DELETE: (table, id) => `DELETE FROM ${table} WHERE id = '${id}'`,
  CLEAR: (table) => `DELETE FROM ${table}`,
  DROP: (table) => `DROP TABLE IF EXISTS ${table}`,
  UPDATE: (table, id, changes) => `UPDATE ${table} SET ${changes} WHERE id = '${id}'`,
  SELECT: (table) => `SELECT * FROM ${table}`,
  QUERY: (table, query) => `SELECT * FROM ${table} WHERE ${query}`,
  INFO: (table) => `SELECT * FROM PRAGMA_TABLE_INFO('${table}')`,
  TABLES: () => 'SELECT name FROM sqlite_master',
};
const validateType = (type) => {
  const valid = Object.keys(types).indexOf(type) != -1;
  return valid;
};
const storage_queue = async.queue((task, cb) => {
  storage_fns[task.perform](task.opts, cb);
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

const dbExists = () => {
  if (fs.existsSync(join(install, 'commands.db'))) return install;
  return config;
};

const init = function (type, path, cb) {
  storagePath = join(dbExists(), 'commands.db');
  backupPath = storagePath;
  const create_db = () => {
    dbComm = new sqlite3.Database(storagePath, ((err) => {
      if (err) {
        if (err.code == 'SQLITE_CANTOPEN') return cb(new Error(SQLITE_ACCESS_ERR));
        return cb(err);
      }
      if (type) {
        if (!validateType(type)) return cb(new Error('Not an allowed type of key'));
        dbComm.run(queries.CREATE(type), (err) => cb && cb(err, dbComm));
      } else return cb(null, dbComm);
      // } else return cb(new Error('Must declare a valid type of table'));
    }));
  };
  if (exports.first_init) {
    exports.first_init = false;
    var existing_db = new sqlite3.Database(storagePath, ((err) => {
      if (err) {
        erase(storagePath, () => {
          storagePath = backupPath;
          create_db();
        });
      } else {
        recover_db(existing_db, (err) => {
          if (err) {
            erase(storagePath, () => {
              storagePath = backupPath;
              return create_db();
            });
          } else return create_db();
        });
      }
    }));
  } else create_db();
};
var storage_fns = {};
storage_fns.set = (opts, cb) => {
  init(opts.type, null, (err) => {
    if (opts.id) opts.data.id = opts.id;
    const column = 'id';
    const { data } = opts;
    const query = `${column} = '${data.id}'`;
    dbComm.all(queries.QUERY(opts.type, query), (err, rows) => {
      if (err || !rows) {
        if (err.code != 'ENOENT') return cb(err, null);
        return cb(err, []);
      }
      if (rows.length == 0) {
        dbComm.run(queries.INSERT(opts.type, opts.data), (err) => {
          const e = err && err.code == 'SQLITE_READONLY' ? SQLITE_ACCESS_ERR : err;
          return cb && cb(e);
        });
      } else return cb(new Error(`Already registered a ${singular(opts.type)} with id: ${opts.id}`));
    });
  });
};
storage_fns.del = (opts, cb) => {
  init(opts.type, null, (err) => {
    dbComm.run(queries.DELETE(opts.type, opts.id), (err) => {
      const e = err && err.code == 'SQLITE_READONLY' ? SQLITE_ACCESS_ERR : err;
      return cb && cb(e);
    });
  });
};
storage_fns.update = (opts, cb) => {
  init(opts.type, null, (err) => {
    let changes;
    const { values } = opts;
    const { columns } = opts;
    if (Array.isArray(columns)) {
      const data = [];
      if (columns.length != values.length || columns.length == 0) return cb(new Error(''));
      columns.forEach((el, index) => {
        const change = `${el} = '${values[index]}'`;
        data.push(change);
      });
      changes = data.join(', '); // duda
    } else {
      changes = `${columns} = '${values}'`;
    }
    dbComm.run(queries.UPDATE(opts.type, opts.id, changes), (err) => {
      const e = err && err.code == 'SQLITE_READONLY' ? SQLITE_ACCESS_ERR : err;
      return cb && cb(e);
    });
  });
};
storage_fns.all = (opts, cb) => {
  init(opts.type, null, (err, db) => {
    if (err) return cb(err);
    dbComm.all(queries.SELECT(opts.type), (err, rows) => {
      if (err) {
        if (err.code != 'ENOENT') return cb(err, null);
        return cb(err, []);
      }
      cb(null, rows);
    });
  });
};
storage_fns.query = (opts, cb) => {
  init(opts.type, null, (err) => {
    const { column } = opts;
    const { data } = opts;
    const query = `${column} = '${data}'`;
    dbComm.all(queries.QUERY(opts.type, opts.hasOwnProperty('query') ? opts.query : query), (err, rows) => {
      if (err) {
        if (err.code != 'ENOENT') return cb(err, null);
        return cb(err, []);
      }
      cb(null, rows);
    });
  });
};
storage_fns.clear = (opts, cb) => {
  dbComm.all(queries.CLEAR(opts.type), (err) => {
    const e = err && err.code == 'SQLITE_READONLY' ? SQLITE_ACCESS_ERR : err;
    return cb && cb(e);
  });
};
// Only for testing purposes
var erase = function (path, cb) {
  fs.unlink(path, (err) => {
    storagePath = null;
    cb && cb(err);
  });
};
// Recover data from the old commands.db file and converts it
var recover_db = function (db, cb) {
  const get_tables = (cb) => {
    db.all(queries.TABLES(), (err, data) => {
      let tables = data.map((x) => x.name);
      tables = tables.filter((x) => !x.includes('autoindex') && !x.includes('keys'));
      return cb(tables);
    });
  };
  get_tables((tables) => {
    if (tables.length == 0) return cb();
    const array = [];
    const data = {};
    // Get number of columns of any table
    db.all(queries.INFO(tables.find((element) => element == 'responses')), (err, columns) => {
      if (err) return;
      if (columns.length > 0) {
        let countColumns = 0;
        columns.forEach((element) => {
          if (types.responses.keys.includes(element.name)) countColumns++;
        });
        if (countColumns < types.responses.keys.length) {
          db.all(queries.DROP('responses'), (err) => {
            if (err) return;
            db.all(queries.CREATE('responses'), (err, rows) => {});
          });
        }
      } else {
        db.all(queries.CREATE('responses'), (err, rows) => {});
      }
    });
    db.all(queries.INFO(tables[0]), (err, columns) => {
      if (err) return cb(err);
      // If there's more than one column it has the new format
      if (columns.length > 1) return cb();
      tables.forEach((table) => {
        array.push((callback) => {
          // Save data from all the tables (except keys)
          db.all(queries.SELECT(table), (err, rows) => {
            data[table] = rows;
            callback();
          });
        });
      });
      async.series(array, (err) => {
        const array2 = [];
        db.all(queries.DROP('keys'));
        tables.forEach((table) => {
          if (table !== 'keys') {
            array2.push((callback2) => {
              db.all(queries.DROP(table), (err) => {
                db.run(queries.CREATE(table), () => {
                  const array3 = [];
                  data[table].forEach((row) => {
                    array3.push((callback3) => {
                      const value = JSON.parse(Buffer.from(row[singular(table)], 'base64').toString());
                      const db_data = Object.values(value)[0];
                      let id;
                      if (table == 'commands') {
                        if (db_data.options && db_data.options.messageID) id = db_data.options.messageID;
                        else id = uuidv4();
                      }
                      if (table == 'files') id = Object.keys(value)[0].split('-')[1];
                      if (table == 'triggers') {
                        id = Object.values(value)[0].id;
                        if (!Object.values(value)[0].persist) db_data.persist = 0;
                        else db_data.persist = 1;
                      }
                      if (table == 'versions') {
                        id = Object.keys(value)[0].split('-')[1];
                        if (!Object.values(value)[0].notified) db_data.notified = 0;
                        else db_data.notified = 1;
                      }
                      storage_fns.set({ type: table, id, data: db_data }, () => callback3());
                    });
                  });
                  async.series(array3, (err) => callback2());
                });
              });
            });
          }
        });
        async.series(array2, (err) => cb());
      });
    });
  });
};
exports.init = init;
exports.erase = erase;
exports.recover_db = recover_db;
module.exports.storage_fns = storage_fns;

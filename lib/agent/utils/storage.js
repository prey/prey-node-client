/* eslint-disable linebreak-style */
const fs = require('fs');
const async = require('async');
const { join } = require('path');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const { config } = require('../../system/paths');

let storagePath;
let backupPath;
let dbComm;

// eslint-disable-next-line prefer-const
let storageFns = {};

exports.first_init = true;

const singular = (type) => type.substring(0, type.length - 1);

const types = {
  commands: {
    schema:
      'id TEXT PRIMARY KEY, command TEXT, target TEXT, options TEXT, started_resp INTEGER, started INTEGER, stopped_resp INTEGER, stopped INTEGER',
    keys: ['id', 'command', 'target', 'options', 'started_resp', 'started', 'stopped_resp', 'stopped'],
    values: (data) => `'${data.id}', '${data.command}', '${data.target}', '${JSON.stringify(data.options).replace(/'/g, '')}' , 0, 'NULL', 0, 'NULL'`,
  },
  geofences: {
    schema: 'id TEXT PRIMARY KEY, name TEXT, state TEXT',
    keys: ['id', 'name', 'state'],
    values: (data) => `'${data.id}', '${data.name}', '${data.state}'`,
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
    values: (data) => `'${data.id}', '${data.name}', '${data.persist}', '${data.synced_at}', '${data.last_exec
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

const validateType = (type) => Object.keys(types).indexOf(type) !== -1;

const storageQueue = async.queue((task, cb) => {
  storageFns[task.perform](task.opts, cb);
}, 1);

// All storage interaction goes through here...
exports.do = (perform, opts, cb) => {
  // Pause queue current execution
  storageQueue.pause();

  // Queue the new command
  storageQueue.push({ perform, opts }, cb);

  // Resume queue
  storageQueue.resume();
};

// Queue's callback...
// storageQueue.drain = function() {
//   console.log('Queue is Done!');
// };

// Only for testing purposes
const erase = (path, cb) => {
  fs.unlink(path, (err) => {
    storagePath = null;
    // eslint-disable-next-line no-unused-expressions
    cb && cb(err);
  });
};

// Recover data from the old commands.db file and converts it
const recoverDb = (db, cb) => {
  const getTables = () => {
    db.all(queries.TABLES(), (err, data) => {
      let tables = data.map((x) => x.name);
      tables = tables.filter((x) => !x.includes('autoindex') && !x.includes('keys'));
      return cb(tables);
    });
  };

  // eslint-disable-next-line consistent-return
  getTables((tables) => {
    if (tables.length === 0) return cb();

    // eslint-disable-next-line prefer-const
    let array = [];
    // eslint-disable-next-line prefer-const
    let data = {};

    // Get number of columns of any table
    // eslint-disable-next-line consistent-return
    db.all(queries.INFO(tables[0]), (err, columns) => {
      if (err) return cb(err);
      // If there's more than one column it has the new format
      if (columns.length > 1) return cb();

      tables.forEach((table) => {
        array.push((callback) => {
          // Save data from all the tables (except keys)
          db.all(queries.SELECT(table), (error, rows) => {
            data[table] = rows;
            callback();
          });
        });
      });

      async.series(array, () => {
        // eslint-disable-next-line prefer-const
        let arrayQueries = [];
        db.all(queries.DROP('keys'));

        tables.forEach((table) => {
          if (table !== 'keys') {
            arrayQueries.push((callback2) => {
              db.all(queries.DROP(table), () => {
                db.run(queries.CREATE(table), () => {
                  // eslint-disable-next-line prefer-const
                  let arrayQueriesToRun = [];

                  data[table].forEach((row) => {
                    arrayQueriesToRun.push((callback3) => {
                      const value = JSON.parse(Buffer.from(row[singular(table)], 'base64').toString());
                      // eslint-disable-next-line prefer-const
                      let dbData = Object.values(value)[0];
                      let id;

                      if (table === 'commands') {
                        // eslint-disable-next-line max-len
                        if (dbData.options && dbData.options.messageID)id = dbData.options.messageID;
                        else id = uuidv4();
                      }
                      if (table === 'geofences') id = Object.values(value)[0].id;
                      // eslint-disable-next-line prefer-destructuring
                      if (table === 'files') id = Object.keys(value)[0].split('-')[1];
                      if (table === 'triggers') {
                        id = Object.values(value)[0].id;
                        if (!Object.values(value)[0].persist) dbData.persist = 0;
                        else dbData.persist = 1;
                      }
                      if (table === 'versions') {
                        // eslint-disable-next-line prefer-destructuring
                        id = Object.keys(value)[0].split('-')[1];
                        if (!Object.values(value)[0].notified) dbData.notified = 0;
                        else dbData.notified = 1;
                      }

                      storageFns.set({ type: table, id, data: dbData }, () => callback3());
                    });
                  });

                  async.series(arrayQueriesToRun, () => callback2());
                });
              });
            });
          }
        });

        async.series(arrayQueries, () => cb());
      });
    });
  });
};

const init = (type, path, cb) => {
  storagePath = path || storagePath || join(config, 'commands.db');
  backupPath = storagePath;

  const createDb = () => {
    // eslint-disable-next-line consistent-return
    dbComm = new sqlite3.Database(storagePath, (error) => {
      if (error) {
        if (error.code === 'SQLITE_CANTOPEN') return cb(new Error(SQLITE_ACCESS_ERR));
        return cb(error);
      }

      if (type) {
        if (!validateType(type)) return cb(new Error('Not an allowed type of key'));
        dbComm.run(queries.CREATE(type), (err) => cb && cb(err, dbComm));
      } else return cb(null, dbComm);
      // } else return cb(new Error('Must declare a valid type of table'));
    });
  };

  if (exports.first_init) {
    exports.first_init = false;
    const existingDb = new sqlite3.Database(storagePath, (error) => {
      if (error) {
        erase(storagePath, () => {
          storagePath = backupPath;
          createDb();
        });
      } else {
        // eslint-disable-next-line consistent-return
        recoverDb(existingDb, (err) => {
          if (err) {
            erase(storagePath, () => {
              storagePath = backupPath;
              return createDb();
            });
          } else return createDb();
        });
      }
    });
  } else createDb();
};

storageFns.set = (opts, cb) => {
  init(opts.type, null, () => {
    // eslint-disable-next-line no-param-reassign
    if (opts.id) opts.data.id = opts.id;

    const column = 'id';
    const { data } = opts;
    const query = `${column} = '${data.id}'`;

    // eslint-disable-next-line consistent-return
    dbComm.all(queries.QUERY(opts.type, query), (error, rows) => {
      if (error || !rows) {
        if (error.code !== 'ENOENT') return cb(error, null);
        return cb(error, []);
      }
      if (rows.length === 0) {
        dbComm.run(queries.INSERT(opts.type, opts.data), (err) => {
          const e = err && err.code === 'SQLITE_READONLY' ? SQLITE_ACCESS_ERR : err;
          return cb && cb(e);
        });
      } else return cb(new Error(`Already registered a ${singular(opts.type)} with id: ${opts.id}`));
    });
  });
};

storageFns.del = (opts, cb) => {
  init(opts.type, null, () => {
    dbComm.run(queries.DELETE(opts.type, opts.id), (err) => {
      const e = err && err.code === 'SQLITE_READONLY' ? SQLITE_ACCESS_ERR : err;
      return cb && cb(e);
    });
  });
};

storageFns.update = (opts, cb) => {
  // eslint-disable-next-line consistent-return
  init(opts.type, null, () => {
    let changes;
    const { values, columns } = opts;

    if (Array.isArray(columns)) {
      // eslint-disable-next-line prefer-const
      let data = [];

      if (columns.length !== values.length || columns.length === 0) return cb(new Error(''));

      columns.forEach((el, index) => {
        data.push(`${el} = '${values[index]}'`);
      });

      changes = data.join(', '); // duda
    } else {
      changes = `${columns} = '${values}'`;
    }

    dbComm.run(queries.UPDATE(opts.type, opts.id, changes), (err) => {
      const e = err && err.code === 'SQLITE_READONLY' ? SQLITE_ACCESS_ERR : err;
      return cb && cb(e);
    });
  });
};

storageFns.all = (opts, cb) => {
  // eslint-disable-next-line consistent-return
  init(opts.type, null, (error) => {
    if (error) return cb(error);

    // eslint-disable-next-line consistent-return
    dbComm.all(queries.SELECT(opts.type), (err, rows) => {
      if (err) {
        if (err.code !== 'ENOENT') return cb(err, null);

        return cb(err, []);
      }
      cb(null, rows);
    });
  });
};

storageFns.query = (opts, cb) => {
  init(opts.type, null, () => {
    const { column, data } = opts;
    const query = `${column} = '${data}'`;
    // eslint-disable-next-line consistent-return
    dbComm.all(queries.QUERY(opts.type, query), (err, rows) => {
      if (err) {
        if (err.code !== 'ENOENT') return cb(err, null);

        return cb(err, []);
      }
      cb(null, rows);
    });
  });
};

storageFns.clear = (opts, cb) => {
  dbComm.all(queries.CLEAR(opts.type), (err) => {
    const e = err && err.code === 'SQLITE_READONLY' ? SQLITE_ACCESS_ERR : err;
    return cb && cb(e);
  });
};

exports.init = init;
exports.erase = erase;
exports.recover_db  = recoverDb;

module.exports.storage_fns  = storageFns;

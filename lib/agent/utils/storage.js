var fs         = require('fs'),
    async      = require('async'),
    join       = require('path').join,
    sqlite3    = require('sqlite3').verbose(),
    config     = require('./../../system/paths').config;

const { v4: uuidv4 } = require('uuid');

var storage_path,
    backup_path,
    db_comm;

exports.first_init = true;

var singular = function(type) {
  return type.substring(0, type.length - 1);
}

var types = {
  commands: {
    schema: 'id TEXT PRIMARY KEY, command TEXT, target TEXT, options TEXT, started_resp INTEGER, started INTEGER, stopped_resp INTEGER, stopped INTEGER, resp_id TEXT',
    keys: ['id', 'command', 'target', 'options', 'started_resp', 'started', 'stopped_resp', 'stopped', 'resp_id'],
    values: (data) => { return `'${data.id}', '${data.command}', '${data.target}', '${JSON.stringify(data.options)}' , 0, 'NULL', 0, 'NULL', 'NULL'` }
  },
  geofences: {
    schema: 'id TEXT PRIMARY KEY, name TEXT, state TEXT',
    keys: ['id', 'name', 'state'],
    values: (data) => { return `'${data.id}', '${data.name}', '${data.state}'` }
  },
  files: {
    schema: 'id TEXT PRIMARY KEY, name TEXT, path TEXT, size TEXT, user TEXT, attempt INTEGER, resumable INTEGER',
    keys: ['id', 'name', 'path', 'size', 'user', 'attempt', 'resumable'],
    values: (data) => { return `'${data.id}', '${data.name}', '${data.path}', '${data.size}', '${data.user}', 0, 0` }
  },
  triggers: {
    schema: 'id TEXT PRIMARY KEY, name TEXT, persist INTEGER, synced_at INTEGER, last_exec INTEGER, automation_events TEXT, automation_actions TEXT',
    keys: ['id', 'name', 'persist', 'synced_at', 'last_exec', 'automation_events', 'automation_actions'],
    values: (data) => { return `'${data.id}', '${data.name}', '${data.persist}', '${data.synced_at}', '${data.last_exec}', '${JSON.stringify(data.automation_events)}', '${JSON.stringify(data.automation_actions)}'` }
  },
  keys: {
    schema: 'id TEXT PRIMARY KEY, value TEXT',
    keys: ['id', 'value'],
    values: (data) => { return `'${data.id}', '${data.value}'`}
  },
  versions: {
    schema: 'id TEXT PRIMARY KEY, "from" TEXT, "to" TEXT, attempts INTEGER, notified INTEGER',
    keys: ['id', '"from"', '"to"', 'attempts', 'notified'],
    values: (data) => { return `'${data.id}', '${data.from}', '${data.to}','${data.attempts}','${data.notified}'`}
  }
}

var SQLITE_ACCESS_ERR = "Access denied to commands database, must run agent as prey user"
exports.store_path = null;

var queries = {                                                                  
  CREATE: (table)              => { return `CREATE TABLE IF NOT EXISTS ${table} (${types[table].schema})` },
  INSERT: (table, data)        => { return `INSERT INTO ${table} (${types[table].keys.join(', ')}) VALUES (${types[table].values(data)})` },
  DELETE: (table, id)          => { return `DELETE FROM ${table} WHERE id = '${id}'` },
  CLEAR:  (table)              => { return `DELETE FROM ${table}` },
  DROP:   (table)              => { return `DROP TABLE IF EXISTS ${table}`},
  UPDATE: (table, id, changes) => { return `UPDATE ${table} SET ${changes} WHERE id = '${id}'` },
  SELECT: (table)              => { return `SELECT * FROM ${table}` },
  QUERY:  (table, query)       => { return `SELECT * FROM ${table} WHERE ${query}`},
  INFO:   (table)              => { return `SELECT * FROM PRAGMA_TABLE_INFO('${table}')`},
  ALTER:  (table, predicate)   => { return `ALTER TABLE ${table} ${predicate}`},
  TABLES: ()                   => { return `SELECT name FROM sqlite_master`}
}

var validate_type = (type) => {
  let valid = Object.keys(types).indexOf(type) == -1 ? false : true;
  return valid;
}

var storage_queue = async.queue((task, cb) => {
  storage_fns[task.perform](task.opts, cb);
}, 1);

// All storage interaction goes through here...
exports.do = (perform, opts, cb) => {
  // Pause queue current execution
  storage_queue.pause();

  // Queue the new command
  storage_queue.push({perform: perform, opts: opts}, cb);

  // Resume queue
  storage_queue.resume();
}

// Queue's callback...
// storage_queue.drain = function() {
//   console.log('Queue is Done!');
// };

var init = function(type, path, cb) {
  storage_path = path ? path : (storage_path ? storage_path : join(config, 'commands.db'));
  backup_path = storage_path;

  var create_db = () => {
    db_comm = new sqlite3.Database(storage_path, function(err) {
      if (err) {
        if (err.code == 'SQLITE_CANTOPEN')
          return cb(new Error(SQLITE_ACCESS_ERR))
        return cb(err)
      }

      if (type) {
        if (!validate_type(type)) return cb(new Error('Not an allowed type of key'))
        db_comm.run(queries.CREATE(type), function(err) {
          return cb && cb(err, db_comm);
        });
      } else return cb(null, db_comm);
      // } else return cb(new Error('Must declare a valid type of table'));
    });
  }

  if (exports.first_init) {
    exports.first_init = false;
    var existing_db = new sqlite3.Database(storage_path, function(err) {
      if (err) {
        erase(storage_path, () => {
          storage_path = backup_path;
          create_db();
        })
      } else {
        recover_db(existing_db, (err) => {
          if (err) {
            erase(storage_path, () => {
              storage_path = backup_path;
              return create_db();
            });
          } else return create_db();
        })
      }
    });
  } else create_db();
}

var storage_fns = {};

storage_fns.set = (opts, cb) => {
  init(opts.type, null, (err) => {
    if (opts.id) opts.data.id = opts.id

    let column = "id",
        data = opts.data,
        query = `${column} = '${data.id}'`;

    db_comm.all(queries.QUERY(opts.type, query), function(err, rows) {
      if (err || !rows) {
        if (err.code != 'ENOENT')
          return cb(err, null);
        return cb(err, []);
      }
      if (rows.length == 0) {
        db_comm.run(queries.INSERT(opts.type, opts.data), (err) => {
          var e = err && err.code == 'SQLITE_READONLY' ? SQLITE_ACCESS_ERR : err
          return cb && cb(e);
        });
      }
      else return cb(new Error(`Already registered a ${singular(opts.type)} with id: ${opts.id}`))
    })
  })
}

storage_fns.del = (opts, cb) => {
  init(opts.type, null, (err) => {
    db_comm.run(queries.DELETE(opts.type, opts.id), function(err) {
      var e = err && err.code == 'SQLITE_READONLY' ? SQLITE_ACCESS_ERR : err
      return cb && cb(e);
    })
  })
}

storage_fns.update = (opts, cb) => {
  init(opts.type, null, (err) => {
    let changes,
        values = opts.values,
        columns = opts.columns;    

    if (Array.isArray(columns)) {

      let data = [];

      if (columns.length != values.length || columns.length == 0)
        return cb(new Error(''));

      columns.forEach((el, index) => {
        let change = `${el} = '${values[index]}'`
        data.push(change)
      });

      changes = data.join(', '); // duda

    } else {
      changes = `${columns} = '${values}'`
    }

    db_comm.run(queries.UPDATE(opts.type, opts.id, changes), function(err) {
      var e = err && err.code == 'SQLITE_READONLY' ? SQLITE_ACCESS_ERR : err
      return cb && cb(e);
    });
  });
}

storage_fns.all = (opts, cb) => {
  init(opts.type, null, (err, db) => {
    if (err) return cb(err);

    db_comm.all(queries.SELECT(opts.type), function(err, rows) {
      if (err) {
        if (err.code != 'ENOENT')
          return cb(err, null);

        return cb(err, []);
      }
      cb(null, rows);
    })
  })
}

storage_fns.query = (opts, cb) => {
  init(opts.type, null, (err) => {
    let column = opts.column,
        data = opts.data,
        query = `${column} = '${data}'`;
    db_comm.all(queries.QUERY(opts.type, opts.hasOwnProperty('query') ? opts.query : query), function(err, rows) {
      if (err) {
        if (err.code != 'ENOENT')
          return cb(err, null);

        return cb(err, []);
      }
      cb(null, rows);
    })
  })
}

storage_fns.clear = (opts, cb) => {
  db_comm.all(queries.CLEAR(opts.type), (err) => {
    var e = err && err.code == 'SQLITE_READONLY' ? SQLITE_ACCESS_ERR : err
    return cb && cb(e);
  })
}

// Only for testing purposes
var erase = function(path, cb) {
  fs.unlink(path, function(err) {
    storage_path = null;
    cb && cb(err);
  })
}

// Recover data from the old commands.db file and converts it
var recover_db = function(db, cb) {
  var get_tables = (cb) => {
    db.all(queries.TABLES(), (err, data) => {
      let tables = data.map(x => x.name);
      tables = tables.filter((x) => { return !x.includes('autoindex') && !x.includes('keys')})
      return cb(tables);
    });
  }

  get_tables((tables) => {
    if (tables.length == 0) return cb();

    let array = [];
    let data = {};

    // Get number of columns of any table
    db.all(queries.INFO(tables.find(element => element == 'commands')), (err, columns) => {
      if (err || columns.filter(element => element.name == 'resp_id').length > 0) return;
      db.run(queries.ALTER('commands', 'ADD resp_id TEXT'), (err) => {
        
      });
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
      })

      async.series(array, (err) => {
        let array2 = [];
        db.all(queries.DROP('keys'));

        tables.forEach((table) => {
          if (table !== 'keys') {
            array2.push((callback2) => {

              db.all(queries.DROP(table), (err) => {
                db.run(queries.CREATE(table), () => {
                  let array3 = [];

                  data[table].forEach((row) => {

                    array3.push((callback3) => {
                      let value = JSON.parse(Buffer.from(row[singular(table)], 'base64').toString()),
                          db_data = Object.values(value)[0],
                          id;

                      if (table == 'commands') {
                        if (db_data.options && db_data.options.messageID) id = db_data.options.messageID;
                        else id = uuidv4();
                      }
                      if (table == 'geofences') id = Object.values(value)[0].id;
                      if (table == 'files')     id = Object.keys(value)[0].split('-')[1];
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

                      storage_fns.set({type: table, id: id, data: db_data}, () => {
                        return callback3();
                      })

                    })
                  });

                  async.series(array3, (err) => {
                    return callback2();
                  })
                });
              });
            });
          }
        });

        async.series(array2, (err) => {
          return cb();
        })
      });

    });
  })
}

exports.init = init;
exports.erase = erase;
exports.recover_db = recover_db;

module.exports.storage_fns = storage_fns;

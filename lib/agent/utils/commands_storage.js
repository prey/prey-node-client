var fs         = require('fs'),
    async      = require('async'),
    join       = require('path').join,
    sqlite3    = require('sqlite3').verbose(),
    config     = require('./../../system/paths').config;

const { v4: uuidv4 } = require('uuid');

var storage_path, db_type, db_comm;

var singular = function(type) {
  return type.substring(0, type.length - 1);
}

// eyJnZW9mZW5jZS0xMzQiOnsiaWQiOjExMSwibmFtZSI6IkhvbWUiLCJzdGF0ZSI6Im91dHNpZGUifX0=
// {"geofence-134":{"id":134,"name":"Casa","state":"outside"}}

// eyJmaWxlLTMzQjYyRTgyRTBDODI3Mzg0MEJFMUE4MTI2OTEwQTU4Ijp7InBhdGgiOiIvVXNlcnMvamF2by9jbGllbnRzLnBsaXN0Iiwic2l6ZSI6NDIsInVzZXIiOiJqYXZvIiwibmFtZSI6ImNsaWVudHMucGxpc3QiLCJyZXN1bWFibGUiOmZhbHNlfX0=
// {"file-33B62E82E0C8273840BE1A8126910A58":{"paths":"/Users/javo/clients.plist","size":42,"user":"javo","name":"clients.plist","resumable":false}}

// eyJzdGFydC1hbGVydCI6eyJjb21tYW5kIjoic3RhcnQiLCJ0YXJnZXQiOiJhbGVydCIsIm9wdGlvbnMiOnsiYWxlcnRfbWVzc2FnZSI6IlRoaXMgZGV2aWNlIGhhcyBiZWVuIGN1cnJlbnRseSBtYXJrZWQgYXMgbG9zdCBieSB0aGUgYWRtaW4uIFBsZWFzZSBjb250YWN0IGphdm9AcHJleWhxLmNvbSB0byBhcnJhbmdlIGl0cyBzYWZlIHJldHVybiBhbmQgYXZvaWQgZnVydGhlciBtZWFzdXJlcy4ifX19
// {"start-alert":{"command":"start","target":"alert","options":{"alert_message":"This device has been currently marked as lost by the admin. Please contact javo@preyhq.com to arrange its safe return and avoid further measures."}}}

// var commands_keys = {'id': 'TEXT', 'command': 'TEXT', 'target': 'TEXT', 'options': 'TEXT', 'started_resp': 'INTEGER', 'started': 'INTEGER', 'stopped_resp':'INTEGER', 'stopped': 'INTEGER'}
//     id: 'TEXT', command: 'TEXT', options: 'TEXT',target: 'TEXT', started_resp: 'INTEGER', stopped_resp: 'INTEGER', started:'INTEGER', stopped : 'INTEGER'},


// eyJ0cmlnZ2VyLTIwMDUiOnsiaWQiOjIwMDUsIm5hbWUiOiJvZW9lIiwic3luY2VkX2F0IjoxNTkyNDk4NDE3MzE2LCJsYXN0X2V4ZWMiOm51bGwsImF1dG9tYXRpb25fZXZlbnRzIjpbeyJ0eXBlIjoiZXhhY3RfdGltZSIsImluZm8iOnsiZGF0ZSI6IjIwMjAwNjE4MTU0MTAwIn19XSwiYXV0b21hdGlvbl9hY3Rpb25zIjpbeyJhY3Rpb24iOnsiY29tbWFuZCI6InN0YXJ0IiwidGFyZ2V0IjoiYWxlcnQiLCJvcHRpb25zIjp7ImFsZXJ0X21lc3NhZ2UiOiJUaGlzIGRldmljZSBoYXMgYmVlbiBjdXJyZW50bHkgbWFya2VkIGFzIGxvc3QuIn19LCJkZWxheSI6MH1dfX0=
/*
{
   "trigger-2005":{
      "id":2005,
      "name":"oeoe",
      "synced_at":1592498417316,
      "last_exec":null,
      "automation_events":[
         {
            "type":"exact_time",
            "info":{
               "date":"20200618154100"
            }
         }
      ],
      "automation_actions":[
         {
            "action":{
               "command":"start",
               "target":"alert",
               "options":{
                  "alert_message":"This device has been currently marked as lost."
               }
            },
            "delay":0
         }
      ]
   }
}
*/

var types = {
  commands: {
    schema: 'id TEXT PRIMARY KEY, command TEXT, target TEXT, options TEXT, started_resp INTEGER, started INTEGER, stopped_resp INTEGER, stopped INTEGER',
    keys: ['id', 'command', 'target', 'options', 'started_resp', 'started', 'stopped_resp', 'stopped'],
    values: (data) => { return `'${data.id}', '${data.command}', '${data.target}', '${JSON.stringify(data.options)}' , 0, 'NULL', 0, 'NULL'` }
  },
  geofences: {
    schema: 'id TEXT PRIMARY KEY, name TEXT, state TEXT',
    keys: ['id', 'name', 'state'],
    values: (data) => { return `'${data.id}', '${data.name}', '${data.state}'` }
  },
  files: {
    schema: 'id TEXT PRIMARY KEY, name TEXT, path TEXT, size TEXT, user TEXT, resumable INTEGER',
    keys: ['id', 'name', 'path', 'size', 'user', 'resumable'],
    values: (data) => { return `'${data.id}', '${data.name}', '${data.path}', '${data.size}', '${data.user}', 0` }
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
  }
  // },
  // versions: {

  // }
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
storage_queue.drain = function() {
  console.log('Queue is Done!');
};

var init = function(type, path, cb) {
  // storage_path = path ? path : join(config, 'commands_new.db');
  storage_path = path ? path : (storage_path ? storage_path : join(config, 'commands_new.db'));

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
  });   
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

    // Debería ser db, revisar!
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
    db_comm.all(queries.QUERY(opts.type, query), function(err, rows) {

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

// Recover data from the ols commands.db file and converts it
exports.recover_db = function(db, cb) {
  // Get a list of the tables inside db
  db.all(queries.TABLES(), (err, data) => {
    if (err) return cb(err);

    let tables = data.map(x => x.name);

    if (tables.length == 0) return cb();

    // For every table we read the columns number
    tables.forEach((table, table_index) => {
      db.all(queries.INFO(table), (err, columns) => {
        if (err) return cb(err);

        // The table exists and has the old format
        if (columns.length == 1) {

          // Collect the table data
          db.all(queries.SELECT(table), (err, rows) => {
            if (err) return cb(err);

            // Drop it...
            db.all(queries.DROP(table), (err) => {
              if (err) return cb(err);

              // Create the table again...
              db.run(queries.CREATE(table), () => {
                if (err) return cb(err);
                // Save the data using the new format
                rows.forEach((row, row_index) => {
                  let value = JSON.parse(Buffer.from(row[singular(table)], 'base64').toString()),
                      data = Object.values(value)[0],
                      id;

                  if (table == 'commands') {
                    if (data.options && data.options.messageID) id = data.options.messageID;
                    else id = uuidv4();
                  }
                  if (table == 'geofences') id = Object.values(value)[0].id;
                  if (table == 'files')     id = Object.keys(value)[0].split('-')[1];
                  if (table == 'triggers')  id = Object.values(value)[0].id;  //validar

                  exports.do('set', {type: table, id: id, data: data}, (err) => {
                    if (table_index == tables.length -1 && row_index == rows.length -1) {
                      return cb();
                    }
                  });
                })
              });
            });
          });
        }
      })
    });
  });
}

exports.init = init;
exports.erase = erase;

module.exports.storage_fns = storage_fns;
// exports.recover_db = recover_db; 
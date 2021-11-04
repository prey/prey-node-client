var fs       = require('fs'),
    join     = require('path').join,
    sqlite3  = require('sqlite3').verbose(),
    config   = require('./../../system/paths').config;
    // fileType = require('./../providers/file-type');

var storage_path, db_type, db_comm;

var SQLITE_ACCESS_ERR = "Access denied to commands database, must run agent as prey user"
exports.store_path = null;

var queries = {
  CREATE: function(type)      { return "CREATE TABLE IF NOT EXISTS " + type + " (" + singular(type) + " text)" },
  INSERT: function(type)      { return "INSERT INTO " + type + " VALUES (?)" },
  SELECT: function(type)      { return "SELECT * FROM " + type },
  DELETE: function(type)      { return "DELETE FROM " + type },
  DROP:   function(type, del) { return type + " WHERE " + singular(type) + " = " + '"'+ del +'"' }
}

var singular = function(db_type) {
  return db_type.substring(0, db_type.length - 1);
}

var check_type = function(key, cb) {
  if (key.includes('start') || key.includes('report-')) return cb(null, 'commands');
  else if (key.includes('file-'))                       return cb(null, 'files');
  else if (key.includes('geofence'))                    return cb(null, 'geofences');
  else if (key.includes('trigger'))                     return cb(null, 'triggers');
  else if (key.includes('version'))                     return cb(null, 'versions');
  else if (key.includes('key'))                         return cb(null, 'keys');
  else return cb(new Error("Not an allowed type of key"))
}

var load = function(type, cb) {
  var db;
  if (!storage_path) {
    return cb(new Error('Invalid path'), null);
  }

  db_comm.all(queries.SELECT(type), function(err, rows) {
    if (err) {
      if (err.code != 'ENOENT')
        return cb(err, null);

      db = {};
      return cb(err, db);
    }

    try {
      var db1 = {};
      for (var i = 0; i < rows.length; i++) {
        var value = JSON.parse(Buffer.from(rows[i][singular(type)], 'base64').toString());
        var key = Object.keys(value)[0];
        db1[key] = value[key];
      }
      db = db1;
    } catch(e) {
      db = {};
    }

    cb(null, db);
  })
}

var remove = function(type, cb) {
  if (!storage_path) {
    // return cb(new Error('Invalid path'));
    return cb();
  }

  db_comm.run(queries.DELETE(type), function(err) {
    var e = err && err.code != 'ENOENT' ? err : null;
    return cb && cb(e);
  })
}

var save = function(type, add, cb) {
  var key = Object.keys(add)[0];
  exports.del(key, function(err) {
    var stmt   = db_comm.prepare(queries.INSERT(type));
    var to_add = Buffer.from(JSON.stringify(add, null, 0)).toString('base64');

    stmt.run(to_add, function(err) {
      var e = err && err.code == 'SQLITE_READONLY' ? SQLITE_ACCESS_ERR : err
      stmt.finalize();
      return cb && cb(e);
    });
  })
}

var drop = function(type, del, cb) {
  var to_del   = Buffer.from(JSON.stringify(del, null, 0)).toString('base64');
  var del_comm = queries.DROP(type, to_del);

  db_comm.all(queries.DELETE(del_comm), function(err) {
    var e = err && err.code == 'SQLITE_READONLY' ? SQLITE_ACCESS_ERR : err
    return cb && cb(e);
  });
}

var check_comm_type = function(type, path, cb) {
  if (type == 'commands') {
    fileType.get_file_type(path, function(err, out){
      if (err) return cb();

      if (out == "ASCII") {
        fs.unlink(path, function(err) {
          var e = err && err.code != 'ENOENT' ? err : null;
          return cb();
        });
      } else {
        return cb();
      }
    });
  } else {
    cb();
  }
}

var check_and_init = function(key, cb) {
  check_type(key, function(err, type) {
    if (err) return cb && cb(err);
    init(type, '', function(err) {
      if (err) return cb && cb(err);
      
      cb(null, type)
    });
  });
}

var init = function(type, path, cb) {
  storage_path = path ? path : (storage_path ? storage_path : join(config, 'commands.db'));
  exports.store_path = storage_path;

  // check_comm_type(type, storage_path, function() {
    db_comm = new sqlite3.Database(storage_path, function(err) {
      if (err) {
        if (err.code == 'SQLITE_CANTOPEN')
          return cb(new Error(SQLITE_ACCESS_ERR))
        return cb(err)
      }
      db_comm.run(queries.CREATE(type), function(err) {
        return cb && cb(err);
      });
    });
  // });
}

exports.set = function(key, data, cb) {
  check_and_init(key, function(err, type) {
    if (err) return cb && cb(err);

    var to_add = {};
    to_add[key] = data;
    save(type, to_add, cb);
  });
}

exports.get = function(key, cb) {
  check_type(key, function(err, type) {
    if (err) return cb && cb(err);
    load(type, function(err, db) {
      if (err) return cb && cb(err);

      cb(null, db[key]);
    })
  });
}

exports.del = function(key, cb) {
  check_and_init(key, function(err, type) {
    if (err) return cb && cb(err);
    load(type, function(err, db) {
      if (err) return cb && cb(err);

      var found = false;
      var to_del = {};

      for (var k in db) {
        if (k == key) {
          found = true;
          to_del[key] = db[k];
        }
      }

      return found ? drop(type, to_del, cb) : cb && cb();
    })
  });
}

exports.update = function(key, del, add, cb) {
  check_and_init(key, function(err, type) {
    if (err) return cb && cb(err);

    drop(type, del, function(err) {
      if (err) return cb() && cb(err);
      save(type, add, cb);
    })
  });
}

exports.all = function(type, cb) {
  init(type, '', function(err) {
    if (err) return cb(err);
    load(type, function(err, db) {
      if (err) return cb(err);

      cb && cb(null, db);
    })
  })
}

// empties db and removes file
exports.clear = function(type, cb) {
  init(type, '', function(err) {
    if (err) return cb(err);
    remove(type, function(err) {
      cb && cb(err);
    });
  });
}

exports.close = function(type, cb) {
  remove(type, function(err) {
    storage_path = null;
    cb && cb(err);
  })
}

exports.erase = function(path, cb) {
  fs.unlink(path, function(err) {
    storage_path = null;
    cb && cb(err);
  })
}

exports.init = init;
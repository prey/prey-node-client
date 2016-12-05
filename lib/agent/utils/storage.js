var fs = require('fs'),
    fileType = require('./../providers/file-type'),
    sqlite3 = require('sqlite3').verbose();

var db_path, db_type, db_comm;

var queries = {
  CREATE: function(type) {return "CREATE TABLE IF NOT EXISTS " + type + " (" + singular(type) + " text)"},
  INSERT: function(type) {return "INSERT INTO " + type + " VALUES (?)"},
  SELECT: function(type) {return "SELECT * FROM " + type},
  DELETE: function(type) {return "DELETE FROM " + type}
}

var singular = function(db_type) {
  return db_type.substring(0, db_type.length - 1);
}

var check_type = function(key, cb) {
  if (key.includes('start'))         return cb(null, 'commands');
  else if (key.includes('file-'))    return cb(null, 'files');
  else if (key.includes('geofence')) return cb(null, 'geofences');
  else return cb(new Error("Not an allowed type of key"))
}

var load = function(type, cb) {
  var db;
  if (!db_path) {
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
        var value = JSON.parse(new Buffer(rows[i][singular(type)], 'base64').toString());
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
  if (!db_path) {
    // return cb(new Error('Invalid path'));
    return cb();
  }

  db_comm.run(queries.DELETE(type), function(err) {
    var e = err && err.code != 'ENOENT' ? err : null;
    return cb && cb(e);
  })
}

var save = function(type, db, cb) {
  // if empty, just remove the thing
  if (Object.keys(db).length == 0) {
    return remove(type, cb);
  }

  remove(type, function(err) {
    if (err) return cb && cb(err);
    db_comm.run(queries.CREATE(type), function(err) {
      var stmt = db_comm.prepare(queries.INSERT(type)); 
      for (var k in db) {
        var db1 = {};
        db1[k] = db[k];
        
        var str = new Buffer(JSON.stringify(db1, null, 0)).toString('base64');
        stmt.run(str);
      }
      stmt.finalize();
      return cb && cb(err);
    }); 
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

exports.init = function(type, path, cb) {
  check_comm_type(type, path, function() {
    db_path = path;
    db_comm = new sqlite3.Database(path);
    db_comm.run(queries.CREATE(type), function(err) {
      return cb && cb(err);
    });
  });
  
}

exports.set = function(key, data, cb) {
  check_type(key, function(err, type) {
    if (err) return cb && cb(err);
    load(type, function(err, db) {

      if (err) return cb && cb(err);

      db[key] = data;
      save(type, db, cb);
    })
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
  check_type(key, function(err, type){
    if (err) return cb && cb(err);
    load(type, function(err, db) {
      if (err) return cb && cb(err);

      var found = false;

      for (var k in db) {
        if (k == key) {
          found = true;
          delete db[key];
        }
      }

      return found ? save(type, db, cb) : cb && cb();
    })
  });
}

exports.set_geofence = function(key, add, cb) {
  check_type(key, function(err, type) {
    if (err) return cb && cb(err);
    var stmt = db_comm.prepare(queries.INSERT(type));
    stmt.run(add);
    stmt.finalize();
    cb();
  });
}

exports.update = function(key, del, add, cb) {
  check_type(key, function(err, type) {
    var del_comm = type + " WHERE " + singular(type) + " = " + '"'+ del +'"';
    if (err) return cb && cb(err);

    db_comm.run(del_comm, function(err) {
      db_comm.all(queries.DELETE(del_comm), function(err) {
        if (err) return cb() && cb(err);
        var stmt = db_comm.prepare(queries.INSERT(type));
        stmt.run(add);
        stmt.finalize();
        cb();
      });
    });
  });
}

exports.all = function(type, cb) {
  load(type, function(err, db) {
    if (err) return cb(err);
    cb && cb(null, db);
  })
}

// empties db and removes file
exports.clear = function(type, cb) {
  remove(type, function(err) {
    cb && cb(err);
  });
}

exports.close = function(type, cb) {
  remove(type, function(err) {
    db_path = null;

    cb && cb(err);
  })
}

exports.erase = function(path, cb) {
  fs.unlink(path, function(err) {
    db_path = null;

    cb && cb(err);
  })
}
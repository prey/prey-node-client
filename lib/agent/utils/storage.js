var fs = require('fs'),
    sqlite3 = require('sqlite3').verbose();

var db, db_path, db_comm;

var load = function(cb) {
  if (!db_path)
    return cb(new Error('Invalid path'));

  db_comm.all("SELECT * from commands", function(err, rows){
    if (err) {
      if (err.code != 'ENOENT')
        return cb(err); // only return error if different from ENOENT

      db = {};
      return cb();
    }

    try {
      db = JSON.parse(new Buffer(rows[0]['command'], 'base64').toString());
    } catch(e) {
      db = {};
    }

    cb();
  })
}

var remove = function(cb) {
  if (!db_path) {
    // return cb(new Error('Invalid path'));
    return cb();
  }
  db_comm.all("DELETE FROM commands", function(err) {
    var e = err && err.code != 'ENOENT' ? err : null;
    return cb && cb(e);
  })
}

var save = function(cb) {
  // if empty, just remove the thing
  if (Object.keys(db).length == 0) {
    return remove(cb);
  }
  remove(function() {
    db_comm.run("CREATE TABLE IF NOT EXISTS commands (command text)");
    var stmt = db_comm.prepare("INSERT INTO commands VALUES (?)");
    var str = new Buffer(JSON.stringify(db, null, 0)).toString('base64');
    stmt.run(str);
    stmt.finalize();
    return cb;
  });
}

exports.init = function(path) {
  db_path = path;
  db_comm = new sqlite3.Database(db_path);
  db_comm.run("CREATE TABLE IF NOT EXISTS commands (command text)");
}

exports.set = function(key, data, cb) {
  load(function(err) {
    if (err) return cb && cb(err);

    db[key] = data;
    save(cb);
  })
}

exports.get = function(key, cb) {
  load(function(err) {
    if (err) return cb && cb(err);

    cb(null, db[key]);
  })
}

exports.del = function(key, cb) {
  load(function(err) {
    if (err) return cb && cb(err);

    var found = false;

    for (var k in db) {
      if (k == key) {
        found = true;
        delete db[key];
      }
    }

    return found ? save(cb) : cb && cb();
  })
}

exports.all = function(cb) {
  load(function(err) {
    if (err) return cb(err);
    cb && cb(null, db);
  })
}

// empties db and removes file
exports.clear = function(cb) {
  remove(function(err) {
    db = {};
    cb && cb(err);
  });
}

exports.close = function(cb) {
  remove(function(err) {
    db = null;
    db_path = null;

    cb && cb(err);
  })
}
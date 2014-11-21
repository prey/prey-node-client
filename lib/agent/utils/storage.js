var fs = require('fs');
var db, db_path;

var load = function(cb) {
  if (db)
    return cb();

  if (!db_path)
    return cb(new Error('Invalid path'));

  fs.readFile(db_path, 'utf8', function(err, data) {
    if (err) {
      if (err.code != 'ENOENT')
        return cb(err); // only return error if different from ENOENT

      db = {};
      return cb();
    }

    try {
      db = JSON.parse(new Buffer(data, 'base64').toString());
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

  fs.unlink(db_path, function(err) {
    var e = err && err.code != 'ENOENT' ? err : null;
    return cb && cb(e);
  })
}

var save = function(cb) {
  // if empty, just remove the thing
  if (Object.keys(db).length == 0) {
    return remove(cb);
  }

  var str = new Buffer(JSON.stringify(db, null, 0)).toString('base64');

  fs.writeFile(db_path, str, function(err) {
    return cb && cb(err);
  })
}

exports.init = function(path) {
  db_path = path;
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

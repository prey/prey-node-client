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
      db = JSON.parse(data);
    } catch(e) {
      db = {};
    }

    cb();
  })
}

var remove = function(cb) {
  fs.unlink(db_path, function(err) {
    return cb && cb(err);
  })
}

var save = function(cb) {
  console.log();

  // if empty, just remove the thing
  if (Object.keys(db).length == 0) {
    return remove(cb);
  }

  var str = JSON.stringify(db, null, 0);

  fs.writeFile(db_path, str, function(err) {
    return cb && cb(err);
  })
}

exports.init = function(path) {
  db_path = path;
}

exports.close = function() {
  db = null;
  db_path = null;
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

exports.clear = function(cb) {
  if (!db_path)
    return cb(new Error('Invalid path'));

  remove(function(err) {
    exports.close();

    cb && cb(err);
  });
}

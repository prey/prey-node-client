var fs = require('fs');
var db, db_path;

var load = function(cb) {
  if (db) return cb();

  fs.readFile(db_path, 'utf8', function(err, data) {
    if (err && err.code != 'ENOENT') return cb(err);

    try {
      db = JSON.parse(data);
    } catch(e) {
      db = {};
    }

    cb();
  })
}

var save = function(cb) {
  // if empty, just remove the thing
  if (Object.keys(db).length == 0) {
    return exports.clear(cb);
  }

  var str = JSON.stringify(db, null, 0);

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

   cb(null, db);
 })
}

exports.clear = function(cb) {
  db = {};

  fs.unlink(db_path, function(err){
    cb && cb(err);
  });
}

var fs = require('fs');
var db;
var db_path;
var logger  = require('./../../common').logger.prefix('actions');

var os_name  = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    commands = require('./' + os_name);

var load = function(cb) {
  //if (db)
  //  return cb();

  //if (!db_path)
  //  return cb(new Error('Invalid path'));

  commands.load_commands(db_path, function(db1, err) {
    cb(db1);
  });
}

var remove = function(cb) {
  if (!db_path) {
    // return cb(new Error('Invalid path'));
    return cb();
  }

  commands.remove_commands(db_path, function(err) {
    var e = err && err.code != 'ENOENT' ? err : null;
    return cb && cb(e);
  });

  // fs.unlink(db_path, function(err) {
  //   var e = err && err.code != 'ENOENT' ? err : null;
  //   return cb && cb(e);
  // })
}

var save = function(db1, cb) {
  logger.info("SAVE!!!!");
  // if empty, just remove the thing
  if (Object.keys(db1).length == 0) {
    logger.info("EMPTY BD!!!!")
    return remove(cb);
  }

  var str = new Buffer(JSON.stringify(db1, null, 0)).toString('base64');

  commands.save_command(db_path, str, function(err) {
    return cb && cb(err);
  });
  // fs.writeFile(db_path, str, function(err) {
  //   return cb && cb(err);
  // })
}

exports.init = function(path) {
  //commands.init_command(path, function(err){
  db_path = path;
  //});

}

exports.set = function(key, data, cb) {
  logger.info("SET!!! CALLING SAVE");
  load(function(db1, err) {
    if (err) return cb && cb(err);

    db1[key] = data;
    save(db1, cb);
  })
}

exports.get = function(key, cb) {
  load(function(db1, err) {
    if (err) return cb && cb(err);

    cb(null, db1[key]);
  })
}

exports.del = function(key, cb) {
  logger.info("DEL!!! CALLING SAVE");
  load(function(db1, err) {
    if (err) return cb && cb(err);

    var found = false;

    for (var k in db1) {
      if (k == key) {
        found = true;
        delete db1[key];
      }
    }
    logger.info("ABOUT TO CALL SAVE!!!");
    return found ? save(db1, cb) : cb && cb();
  })
}

exports.all = function(cb) {
  load(function(db1, err) {;
    if (err) return cb({}, err);

    cb && cb(null, db1);
  })
}

// empties db and removes file
exports.clear = function(cb) {
  remove(function(err) {
    cb && cb({}, err);
  });
}

exports.close = function(cb) {
  remove(function(err) {
    db_path = null;

    cb && cb(null, err);
  })
}

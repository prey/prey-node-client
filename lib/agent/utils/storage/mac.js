var fs = require('fs');

exports.save_command = function(db_path, str, cb) {
  fs.writeFile(db_path, str, function(err) {
    return cb && cb(err);
  })
}

exports.remove_command = function(db_path, cb) {
  fs.unlink(db_path, function(err) {
    var e = err && err.code != 'ENOENT' ? err : null;
    return cb && cb(e);
  })
}

exports.load_commands = function(db_path, db) {
  fs.readFile(db_path, 'utf8', function(err, data) {
    if (err) {
      if (err.code != 'ENOENT')
        return cb(err); // only return error if different from ENOENT

      db = {};
      return db;
    }

    try {
      db = JSON.parse(new Buffer(data, 'base64').toString());
    } catch(e) {
      console.log("ERROR!!", e);
      db = {};
      return db;
    }

    return db;
  })
}
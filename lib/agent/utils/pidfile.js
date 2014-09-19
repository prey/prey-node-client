var fs = require('fs');

exports.remove = function(pid_file, cb){
  fs.unlink(pid_file, function(err) {
    return cb && cb(err);
  });
};

exports.read = function(file, cb) {

  fs.stat(file, function(err, stat){
    if (err) // not there probably
      return cb(err);

    fs.readFile(file, function(err, str) {
      if (err) return cb(err);

      var pid = parseInt(str),
          obj = {stat: stat, pid: pid};

      try {
        process.kill(pid, 0);
        cb(null, obj);
      } catch(e) {
        if (e.code == 'EPERM') // other user owns the process
          return cb(null, obj);

        cb(e); // probaby e.code == 'ESRCH', not really running
      }

    });

  });
}

exports.store = function(file, callback){
  exports.read(file, function(err, running) {
    if (running) return callback(err, running);

    // if all was good, then callback(err) will be null
    fs.writeFile(file, process.pid.toString(), callback);
  });
};

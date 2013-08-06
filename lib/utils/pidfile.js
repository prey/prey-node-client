var fs = require('fs');

exports.remove = function(pid_file, cb){
  fs.unlink(pid_file, cb);
};

exports.read = function(file, cb) {

  fs.stat(file, function(err, stat){
    if (err) // not there probably
      return cb(err);

    fs.readFile(file, function(err, str) {
      if (err) return cb(err);
      var pid = parseInt(str);

      try {
        process.kill(pid, 0);
        cb(null, {stat: stat, pid: pid});
      } catch(e) {
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

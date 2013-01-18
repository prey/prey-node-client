var fs = require('fs');

exports.remove = function(pid_file){
  fs.unlink(pid_file);
};

exports.store = function(pid_file, callback){
  fs.stat(pid_file, function(err, stat){

    if (!err) {
      var pid = parseInt(fs.readFileSync(pid_file).toString());
      // console.error("\nPrey seems to be running already! (PID: " + pid.toString() + ")");

      try {
        process.kill(pid, 0);
        return callback(null, {stat: stat, pid: pid});
      } catch(e) {
        // if (e.code === 'ESRCH')
        //  console.error("Not really, pidfile was just lying around.");
      }
    }

    // if all was good, then callback(err) will be null
    fs.writeFile(pid_file, process.pid.toString(), callback);
  });
};

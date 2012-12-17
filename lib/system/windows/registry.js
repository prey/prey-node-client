var exec = require('child_process').exec;

exports.get = function(path, key, cb){
  var cmd = 'reg query ' + path + ' /v ' + key;

  exec(cmd, function(err, stdout) {
    if (err) return cb(err);

    var match = stdout.toString().match(/REG_SZ\s+(.+)/);

    if (match)
      cb(null, match[1]);
    else
      cb(new Error('Unable to find key ' + key + ' in ' + path))

  });
}

exports.set = function(path, key, val, cb){
  var cmd = 'reg add ' + path + ' /v ' + key + ' /d ' + val + ' /f';
  exec(cmd, cb);
}

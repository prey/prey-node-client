var spawn = require('child_process').spawn;

/**
 * Make sure all parameters specified in array are available from command line
 * and have values.
 **/
exports.required = function(req) {
  var vals = [];
  var missing = [];
  req.forEach(function(p) {
    var val = get_parameter_value(p);
    if (!val)
      missing.push(p);
    else
      vals.push(val);
  });
  if (missing.length > 0) return {values:null,missing:missing};
  return {values:vals};
};

exports.verify = function(hash){
  var obj = {};
  for (var key in hash) {
    if (typeof hash[key] !== 'undefined')
      obj[key] = hash[key]
  }
  return obj;
}

exports.run_synced = function(cmd, args, cb){

  var timer, child = spawn(cmd, args);

  child.stdout.on('data', function(data){
    console.log(data.toString().replace(/\n$/, ''));
  })

  child.stderr.on('data', function(data){
    console.log(data.toString().trim());
  })

  child.on('exit', function(code){
    if (timer) clearTimeout(timer);
    console.log('Exited with code ' + code);
    cb(code);
  });

  // don't allow synced processes to run for more than a minute
  timer = setTimeout(function(){
    if (!child.exitCode)
      child.kill();
  }, 60 * 1000);
}

exports.run_detached = function(cmd, args, cb){
  var opts = { detached: true, stdio: 'ignore' };
  var child = spawn(cmd, args, opts);
  child.unref();
  cb && cb();
};

exports.check_connection = function(cb){
  require('dns').lookup('google.com', cb);
};

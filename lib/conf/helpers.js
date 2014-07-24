var util   = require('util'),
    spawn  = require('child_process').spawn,
    dialog = require('dialog');

exports.log = function(msg) {
  if (!msg) return;

  if (typeof msg == 'object')
    msg = util.inspect(msg);

  if (process.stdout.writable)
    process.stdout.write(msg.toString() + "\n");
}

// prints and shows a message dialog
exports.shout = function(msg) {
  exports.log(msg);
  dialog.info(msg);
}

/**
 * Make sure all parameters specified in array are available from command line
 * and have values.
 **/
exports.required = function(req) {
  var vals = [],
      missing = [];

  req.forEach(function(p) {
    var val = get_parameter_value(p);
    if (!val)
      missing.push(p);
    else
      vals.push(val);
  });

  if (missing.length > 0)
    return {values: null, missing: missing};
  return {values: vals};
};

exports.verify = function(hash){
  var obj = {};

  for (var key in hash) {
    if (typeof hash[key] !== 'undefined')
      obj[key] = hash[key]
  }

  return obj;
}

exports.run_synced = function(cmd, args, opts, cb) {

  var timer,
      finished,
      child = spawn(cmd, args, opts || {});

  var print = function(str) {
    if (process.stdout.writable)
      util.puts(str);
  }

  var done = function(e, code) {
    if (timer) clearTimeout(timer);
    if (finished) return;

    print('Exited with code ' + code);
    finished = true;
    cb(e, code);
  }

  child.stdout.on('data', function(data){
    print(data.toString().replace(/\n$/, ''));
  })

  child.stderr.on('data', function(data){
    print(data.toString().trim());
  })

  child.on('error', function(err) {
    if (err == 'ENOENT')
      err.message = 'ENOENT - Command not found: ' + cmd;

    done(err);
  })

  child.on('exit', function(code) {
    done(null, code);
  });

  // don't allow synced processes to run for more than a minute
  timer = setTimeout(function(){
    if (!child.exitCode)
      child.kill();
  }, 60 * 1000);
}

exports.check_connection = function(cb){
  require('dns').lookup('google.com', cb);
};

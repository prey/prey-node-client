var util   = require('util'),
    spawn  = require('child_process').spawn;

module.exports = function(cmd, args, opts, cb) {

  var opts = opts || {};

  // set detached so that when running from an already-detached process we don't
  // get a new console window popping up.
  opts.detached = true;

  var timer,
      finished,
      child = spawn(cmd, args, opts);

  var print = function(str) {
    if (process.stdout.writable)
      console.log(str);
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

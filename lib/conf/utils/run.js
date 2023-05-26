// run.js, by tomas pollak
//
// call spawn() with exec() syntax
// pass opts.stdout or opts.stderr to capture
// the output of the command's streams

var path  = require('path'),
    spawn = require('child_process').spawn;

var debugging = !!process.env.DEBUG;

var check_error = function(code, out, err) {
  if (code == 0) return;

  var str = err || out;
  var error = new Error(str.trim());
  error.exit_code = code;
  return error;
}

module.exports = function(cmd, opts, cb) {
  var out  = '',
      err  = '',
      args = Array.isArray(cmd) ? cmd : cmd.split(' '),
      bin  = args.shift();

  if (!opts.cwd && bin[0] == '/')
    opts.cwd = path.dirname(bin);

  if (debugging) {
    console.log(bin);
    console.log(args);
  }

  var child = spawn(bin, args, opts);

  child.stdout.on('data', function(data) {
    out += data;
    if (opts.stdout && opts.stdout.writable)
      opts.stdout.write(data);
  });

  child.stderr.on('data', function(data) {
    err += data;
    if (opts.stderr && opts.stderr.writable)
      opts.stderr.write(data);
  });

  child.on('error', function(err) {
    if (opts.stderr && opts.stderr.writable)
      opts.stderr.write(err.toString());
  });

  child.on('exit', function(code) {
    var error = check_error(code, out, err);
    cb && cb(error, out, err);
  });
}

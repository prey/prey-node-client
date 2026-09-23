// @ts-check
var util   = require('util'),
    spawn  = require('child_process').spawn;

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {import('child_process').SpawnOptions} opts
 * @param {(err: (Error|null), code?: (number|null)) => void} cb
 */
module.exports = function(cmd, args, opts, cb) {

  var options = opts || {};

  // set detached so that when running from an already-detached process we don't
  // get a new console window popping up.
  options.detached = true;

  /** @type {NodeJS.Timeout=} */
  var timer;
  /** @type {boolean=} */
  var finished;
  /** @type {import('child_process').ChildProcess} */
  var child;

  // spawn can throw synchronously (e.g. `spawn EROFS` when the inherited cwd is
  // invalid) — report it through the callback so callers can roll back cleanly.
  try {
    child = spawn(cmd, args, options);
  } catch (e) {
    cb(/** @type {Error} */ (e));
    return;
  }

  /**
   * @param {string} str
   */
  var print = function(str) {
    if (process.stdout.writable)
      console.log(str);
  }

  /**
   * @param {(Error|null)} e
   * @param {(number|null)} [code]
   */
  var done = function(e, code) {
    if (timer) clearTimeout(timer);
    if (finished) return;

    print('Exited with code ' + code);
    finished = true;
    cb(e, code);
  }

  if (child.stdout) {
    child.stdout.on('data', function(data){
      print(data.toString().replace(/\n$/, ''));
    });
  }

  if (child.stderr) {
    child.stderr.on('data', function(data){
      print(data.toString().trim());
    });
  }

  child.on('error', function(err) {
    if (/** @type {any} */ (err) == 'ENOENT')
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
  }, 120 * 1000);
}

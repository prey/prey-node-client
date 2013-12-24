var fs       = require('fs'),
    join     = require('path').join,
    os_name  = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    os_wipe  = require('./' + os_name),
    paths    = os_wipe.paths;

var home     = process.env.HOME,
    stop_now = false,
    removed  = 0;

var debug = function(str) {
  if (process.env.DEBUG)
    console.log(str);
}

exports.documents = function(cb) {
  wipe('documents', cb)
}

exports.emails = function(cb) {
  wipe('emails', cb)
}

exports.passwords = function(cb) {
  wipe('keychains', cb)
}

exports.cookies = function(cb) {
  wipe('browsers', cb) 
}

exports.stop = function() {
  stop_now = true;
}

var wipe = function(what, cb) {
  if (!home || home == '')
    return cb(new Error('Home path not found!'))
  
  var last_err, dirs = 0;
  
  stop_now = false; // in case it was previously stopped
  removed  = 0; // reset counter

  var done = function(err) {
    if (err && err.code != 'ENOENT') last_err = err;
    --dirs || cb(last_err, removed);
  }

  paths[what].forEach(function(dir) {
    dirs++;
    chop_tree(join(home, dir), done)
  })
}

/*  based on wrench.rmdirRecursive
 *
 *  Recursively dives through directories and obliterates everything about it.
 *  Modified to allow stopping the process in the middle. (tomas)
 *
 */
var chop_tree = function(dir, clbk) {
  console.warn('Removing recursively ' + dir);

  fs.readdir(dir, function(err, files){
    if (err || stop_now) return clbk(err);

    (function rmFile(err){
      if (err || stop_now) return clbk(err);

      var filename = files.shift();
      if (filename === null || typeof filename == 'undefined') {
        // fs.rmdir(dir, clbk); // testing for now
        debug('Removing dir: ' + dir);
        return clbk();
      }

      var file = join(dir, filename);
      fs.lstat(file, function(err, stat){
        if (err || stop_now) 
          return clbk(err);

        if (stat.isDirectory())
          chop_tree(file, rmFile);
        else {
          if (removed) removed++;
          debug('Removing file: ' + file);
          rmFile(); // in case you just want to test 
          // fs.unlink(file, rmFile);
        }
      });
    })();

  });
};

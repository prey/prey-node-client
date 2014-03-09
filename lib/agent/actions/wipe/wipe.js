var fs       = require('fs'),
    join     = require('path').join,
    os_name  = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    os_wipe  = require('./' + os_name),
    paths    = os_wipe.paths;

var output   = null,
    stop_now = false,
    removed  = 0;

var homes = {
  linux   : '/home',
  darwin  : '/Users',
  win32   : join('C:', 'Users')
}

if (process.platform == 'win32' && parseFloat(require('os').release()) < 6) {
  homes.windows = join('C:', 'Documents and Settings')
}

var write = function(str) {
  if (output)
    output.write(str + '\n');
}

exports.output = function(stream) {
  output = stream;
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

  var last_err,
      dirs  = 0,
      root  = homes[process.platform];

  stop_now = false; // in case it was previously stopped
  removed  = 0; // reset counter

  var done = function(err) {
    if (err && err.code != 'ENOENT') last_err = err;
    --dirs || cb(last_err, removed);
  }

  fs.readdir(root, function(err, list) {

    if (err) return cb(err);

    list.forEach(function(user) {
      paths[what].forEach(function(dir) {
        dirs++;
        chop_tree(join(root, user, dir), done)
      })
    });

  });

}

/*  based on wrench.rmdirRecursive
 *
 *  Recursively dives through directories and obliterates everything about it.
 *  Modified to allow stopping the process in the middle. (tomas)
 *
 */
var chop_tree = function(dir, clbk) {
  write('Walking directory ' + dir);

  fs.readdir(dir, function(err, files){
    if (err || stop_now) return clbk(err);

    (function rmFile(err){
      if (err || stop_now) return clbk(err);

      var filename = files.shift();
      if (filename === null || typeof filename == 'undefined') {
        write('Removing directory: ' + dir);
        return fs.rmdir(dir, clbk);
      }

      var file = join(dir, filename);
      fs.lstat(file, function(err, stat){
        if (err || stop_now)
          return clbk(err);

        if (stat.isDirectory())
          chop_tree(file, rmFile);
        else {
          if (removed) removed++;
          write('Removing file: ' + file);
          fs.unlink(file, rmFile);
        }
      });
    })();

  });
};

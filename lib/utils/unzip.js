// simple wrapper around decompress-zip, that preserves the executable bits
// on extracted files. it also filters all the rubbish that OSX puts into zip archives
// by Tomas Pollak. The octal function is also taken from decompress-zip, by the way.

'use strict';

var path  = require('path'),
    chmod = require('fs').chmod,
    queue = require('async').queue,
    DecompressZip = require('decompress-zip'),
    is_windows = process.env == 'win32';

var skip_files = ['__MACOSX', '.DS_Store', '._.DS_Store'];

var debugging = process.env.DEBUG;

var debug = function(str) {
  if (debugging) console.log(str)
}

var octal = function (number, digits) {
  var result = '';
  for (var i = 0; i < digits; i++) {
    result = (number & 0x07) + result;
    number >>= 3;
  }
  return result;
};

module.exports = function(file, new_path, cb) {

  var error,
      result,
      zip = new DecompressZip(file);
  
  var done = function(err, res) { 
    if (err || q.length() == 0)
      return cb && cb(err, res);

    debug('Done. Found ' + q.length() + ' elements in queue!');
    result = res; // store result so we can return it when queue finishes
    q.resume();
  }

  var q = queue(function (task, callback) {
    var file = path.join(new_path, task.file);
    debug('Chmodding ' + file + ' to ' + task.mode);
    chmod(file, task.mode, function(err) {
      if (err) debug(err);
      callback();
    });
  }, 2);

  // called when the queue reaches zero, meaning all the work is done
  q.drain = function() {
    return cb && cb(error, result);
  }

  q.pause(); // the queue will begin when the files are extracted, not before

  zip.on('file', function(file) {
    // console.log(file.path);
    if (!is_windows && file.type == 'File' && file.path.indexOf('node_modules') == -1) {
      var mode = octal(file.mode, 4);
      if (mode != '0644') {
        debug('Queueing mode set for ' + file.path)
        q.push({ file: file.path, mode: mode });
      }
    }
  });

  zip.on('extract', function(result) {
    done(null, result);
  });

  zip.on('error', function(err) {
    done(err);
  }); 

  zip.extract({
    path   : path.resolve(new_path),
    filter : function (file) {
      return skip_files.indexOf(file.filename) == -1;
      // return file.type !== "SymbolicLink";
    }
  });

}
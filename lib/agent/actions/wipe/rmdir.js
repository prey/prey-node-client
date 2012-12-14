/*
  Modified version of rmdirRecursive from wrench-js
  That allows stopping it in the middle of the process.
*/

var fs = require('fs'),
    join = require('path').join;

/*  wrench.rmdirRecursive("directory_path", callback);
 *
 *  Recursively dives through directories and obliterates everything about it.
 */
exports.rmdirRecursive = function rmdirRecursive(dir, clbk){
  fs.readdir(dir, function(err, files){
    if (err) return clbk(err);
    (function rmFile(err){
      if (err) return clbk(err);

      var filename = files.shift();
      if (filename === null || typeof filename == 'undefined')
          return fs.rmdir(dir, clbk);

      var file = join(dir, filename);
      fs.lstat(file, function(err, stat){
          if (err) return clbk(err);
          if (stat.isDirectory())
            rmdirRecursive(file, rmFile);
          else
            console.log('Removing ' + file)
            // fs.unlink(file, rmFile);
      });
    })();
  });
};

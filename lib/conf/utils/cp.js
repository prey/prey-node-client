var fs = require('fs'),
    join = require('path').join,
    async = require('async');

/**
 * Copy a single file.
 **/
var cp = exports.cp = function(src, dst, callback) {
  var is = fs.createReadStream(src);
  var os = fs.createWriteStream(dst);
  is.on("end", callback);
  is.pipe(os);
};

/**
 * Recursive file copy.
 **/
var cp_r = exports.cp_r = function(src, dst, callback) {
  fs.stat(src, function(err, stat) {
    if (stat.isDirectory()) {
      fs.mkdir(dst, function(err) {
        fs.readdir(src, function(err, files) {
          async.forEach(files, function(file, cb) {
            cp_r(join(src, file), join(dst, file), cb);
          }, callback);
        });
      });
    } else {
      cp(src, dst, callback);
    }
  });
};

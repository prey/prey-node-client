var fs = require('fs'),
    async = require('async');

/**
 * Copy a single file.
 **/
exports.cp = function(src, dst, callback) {
  var is = fs.createReadStream(src);
  var os = fs.createWriteStream(dst);
  is.on("end", callback);
  is.pipe(os);
};

/**
 * Recursive file copy.
 **/
exports.cp_r = function(src, dst, callback) {
  fs.stat(src, function(err, stat) {
    if (stat.isDirectory()) {
      fs.mkdir(dst, function(err) {
        fs.readdir(src, function(err, files) {
          async.forEach(files, function(file, cb) {
            cp_r(gpath.join(src, file), gpath.join(dst, file), cb);
          }, callback);
        });
      });
    } else {
      cp(src, dst, callback);
    }
  });
};

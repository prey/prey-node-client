var fs    = require('fs'),
    join  = require('path').join,
    async = require('async');

/**
 * Copy a single file.
 **/
var cp = exports.cp = function(source, target, cb) {
  var is  = fs.createReadStream(source),
      os  = fs.createWriteStream(target),
      out = 0;

  var done = function(err) {
    if (out++ > 0) return;
    cb(err);
  };

  is.on('end', done);
  is.on('error', done);
  os.on('error', done);

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

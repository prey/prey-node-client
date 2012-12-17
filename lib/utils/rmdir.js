var fs = require('fs'),
    join = require('path').join;

var rmdirRecursive = module.exports = function(dir, clbk){
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
          else {
            fs.unlink(file, rmFile);
          }
      });
    })();

  });
};

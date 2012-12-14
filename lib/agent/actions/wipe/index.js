var fs = require('fs'),
    join = require('path').join,
    Emitter = require('events').EventEmitter;

var count = 0, stop_now;

exports.start = function(opts, cb){

  var opts = opts || {};
  var dir = opts.path || opts.dir || process.env.HOME;
  var confirm = opts.confirm == 'ireallyknowwhatiamdoing';

//  if (!confirm)
//    return cb(new Error('Invalid confirmation string.'));

  var emitter = new Emitter();
  stop_now = false;
  count = 0;

  console.log('Removing recursively ' + dir);

  rmdirRecursive(dir, function(err, count){
    emitter.emit('end', err, count);
  })

  setTimeout(function(){
    stop_now = true;
  }, 1000)

  cb(null, emitter);
}

exports.stop = function(){
  stop_now = true;
}


/*  wrench.rmdirRecursive("directory_path", callback);
 *
 *  Recursively dives through directories and obliterates everything about it.
 *
 *  Modified to allow stopping the process in the middle. (tomas)
 */
var rmdirRecursive = function rmdirRecursive(dir, clbk){
  fs.readdir(dir, function(err, files){
    if (err || stop_now) return clbk(err);

    (function rmFile(err){
      if (err || stop_now) return clbk(err);

      var filename = files.shift();
      if (filename === null || typeof filename == 'undefined') {
        // fs.rmdir(dir, clbk);
        console.log('Removing dir: ' + dir);
        return clbk();
      }

      var file = join(dir, filename);
      fs.lstat(file, function(err, stat){
          if (err || stop_now) return clbk(err);
          if (stat.isDirectory())
            rmdirRecursive(file, rmFile);
          else {
            count++;
            console.log('Removing ' + file);
            rmFile();
            // fs.unlink(file, rmFile);
          }
      });
    })();

  });
};

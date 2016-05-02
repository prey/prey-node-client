var join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    common    = require('./../../common'),
    hooks     = require('./../../hooks'),
    triggers  = require('./../../triggers'),
    storage   = require('./../../utils/storage'),
    fileretrieval = require(join(base_path, 'actions', 'fileretrieval'));

var logger   = common.logger;
var watching  = false;

var files_path = join(common.system.paths.config, 'files.db');
storage.init(files_path);

var exist = function(key, cb){
  storage.all(function(err, files) {
    if (err)
      return logger.error(err.message);
    if (files[key]) 
      return cb(true);
    else
      return cb(false);
  })
}

exports.store = function(id, path, user) {
  if (!user) return;
  exist(id, function(cb) {
    if (cb == false) {
      logger.debug('Storing file_id in DB: ' + id);
      var opts = {
        path: path,
        user: user
      }
      storage.set(id, opts);
    }
    else
      return;
  });
}

exports.del = function(id) {
  logger.debug('Removing file_id from DB: ' + id);
  storage.del(id);
}

exports.show = function() {
  storage.all(function(err, files) {
    if (err)
      return logger.error(err.message);

    var count = Object.keys(files).length;
    if (count <= 0)
      return;
    console.log(count);
    // logger.warn('Relaunching ' + count + ' commands previously in execution.');
    console.log(files);
    // for (var key in commands)
    //   console.log(commands);
  });
}

exports.run_stored = function(cb) {
  storage.all(function(err, files) {
    if (err)
      return logger.error(err.message);

    var count = Object.keys(files).length;
    if (count <= 0)
      return;
    console.log(count);

    logger.warn('Re-uploading ' + count + ' pending files.');

    for (var key in files) {
      opts = {
        file_id: key,
        path: files[key].path,
        user: files[key].user,
        resumable: true
      }
      fileretrieval.start(opts, cb)
    }
  })
}

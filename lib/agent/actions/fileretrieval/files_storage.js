var join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    common    = require('./../../common'),
    hooks     = require('./../../hooks'),
    triggers  = require('./../../triggers'),
    storage   = require('./../../utils/storage'),
    fileretrieval = require(join(base_path, 'actions', 'fileretrieval'));

var logger   = common.logger;
    watching = false;

var NAMESPACE = "fr/";

var exist = function(id, cb) {
  var key = NAMESPACE + id;
  storage.all(function(err, files) {
    if (err)
      return logger.error(err.message);
    if (files[key]) 
      return cb(true);
    return cb(false);
  })
}

exports.store = function(id, path, size, user) {
  exist(id, function(cb) {
    if (cb == false) {
      logger.debug('Storing file_id in DB: ' + id);
      var opts = {
        path: path,
        size: size,
        user: user
      }
      storage.set(NAMESPACE + id, opts);
    }
  });
}

exports.del = function(id) {
  logger.debug('Removing file_id from DB: ' + id);
  storage.del(NAMESPACE + id);
}

exports.run_stored = function(cb) {
  storage.all(function(err, files) {
    if (err)
      return logger.error(err.message);

    var count = Object.keys(files).length;
    if (count <= 0)
      return;

    logger.warn('Re-uploading ' + count + ' pending files.');

    for (key in files) {
      if(key.indexOf(NAMESPACE) != 0) {
        continue;
      }
      var opts = {
        file_id: key.substring(3, key.length),
        path: files[key].path,
        user: files[key].user,
        size: files[key].size,
        resumable: true
      }
      fileretrieval.start(opts, cb);
    }
  })
}

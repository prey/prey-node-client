var join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    common    = require('./../../common'),
    hooks     = require('./../../hooks'),
    triggers  = require('./../../triggers'),
    storage   = require('./../../utils/storage'),
    fileretrieval = require(join(base_path, 'actions', 'fileretrieval'));

var logger   = common.logger;
    watching = false;

var exist = function(id, cb) {
  var key = ['file', id].join('-');
  storage.all('files', function(err, files) {
    if (err)
      return err.message;
    if (files[key])
      return cb(true);
    return cb(false);
  });
}

exports.store = function(id, path, size, user, name) {
  exist(id, function(cb) {
    if (cb == false) {
      logger.debug('Storing file_id in DB: ' + id);
      var opts = {
        path: path,
        size: size,
        user: user,
        name: name
      }
      var key = ['file', id].join('-');
      storage.set(key, opts);
    }
  });
}

exports.del = function(id) {
  var key = ['file', id].join('-');
  logger.debug('Removing file_id from DB: ' + id);
  storage.del(key);
}

exports.run_stored = function(cb) {
  storage.all('files', function(err, files) {
    if (err)
      return logger.error(err.message);

    var count = Object.keys(files).length;
    if (count <= 0)
      return;
    logger.warn('Re-uploading ' + count + ' pending files.');

    for (key in files) {
      var opts = {
        path: files[key].path,
        user: files[key].user,
        name: files[key].name,
        size: files[key].size,
        file_id: key.substring(5, key.length),
        resumable: true
      }
      fileretrieval.start(opts, cb);
    }
  })
}

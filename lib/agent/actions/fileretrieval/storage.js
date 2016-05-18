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
      return err.message;
    if (files[key])
      return cb(true);
    return cb(false);
  });
}

exports.store = function(id, path, size, user, name) {
  exist(id, function(cb) {
    if (cb == false) {
      var opts = {
        path: path,
        size: size,
        user: user,
        name: name
      }
      storage.set(NAMESPACE + id, opts);
    }
  });
}

exports.del = function(id) {
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
        path: files[key].path,
        user: files[key].user,
        name: files[key].name,
        size: files[key].size,
        file_id: key.substring(3, key.length),
        resumable: true
      }
      fileretrieval.start(opts, cb);
    }
  })
}

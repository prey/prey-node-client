var join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    common    = require('./../../common'),
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
      return cb(null, true);
    return cb(null, false);
  });
}

exports.store = function(id, path, size, user, name, resumable) {
  exist(id, function(err, out) {
    if (out == false) {
      logger.debug('Storing file_id in DB: ' + id);
      var opts = {
        path: path,
        size: size,
        user: user,
        name: name,
        resumable: false
      }
      var key = ['file', id].join('-');
      storage.set(key, opts);
    }
  });
}

exports.update = function(id, path, size, user, name, resumable, cb) {
  var key = ["file", id].join("-");

  var file_del,
      file_add,
      obj_del = {},
      obj_add = {},

  file_del = {
    "path": path,
    "size": size,
    "user": user,
    "name": name,
    "resumable": resumable
  }

  file_add = {
    "path": path,
    "size": size,
    "user": user,
    "name": name,
    "resumable": !resumable
  }

  obj_del[key] = file_del;
  obj_add[key] = file_add;

  storage.update(key, obj_del, obj_add, cb);
}

exports.del = function(id) {
  var key = ['file', id].join('-');
  logger.debug('Removing file_id from DB: ' + id);
  storage.del(key);
}

exports.run_stored = function(host, cb) {
  if (host != 'solid.preyproject.com') return;

  storage.all('files', function(err, files) {
    if (err)
      return logger.error(err.message);

    var count = Object.keys(files).length;
    if (count <= 0)
      return;
    logger.warn('Re-uploading ' + count + ' pending files.');

    for (key in files) {
      var opts = {
        path:      files[key].path,
        user:      files[key].user,
        name:      files[key].name,
        size:      files[key].size,
        file_id:   key.substring(5, key.length),
        resumable: files[key].resumable
      }
      fileretrieval.start(opts, cb);
    }
  })
}

exports.exist = exist;
var join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    common    = require('./../../common'),
    //   = require('./../../utils/storage'),
    storage   = require('./../../utils/commands_storage'),
    fileretrieval = require(join(base_path, 'actions', 'fileretrieval'));

var logger   = common.logger;
    watching = false;


 exports.get_files = function (cb) {
  storage.do('all', { type: 'files' }, (err, rows) => {
    if (err) return cb(new Error ('Error retrieving file from local database'))
    return cb(null,rows)
  })
}

exports.get_file_by_id = function (id,cb) {
  storage.do('query', { type: 'files' ,column : "id", data: id }, function (err,rows) {
    if (err) return cb(new Error ('Error retrieving file'))
    return cb(null,rows)
  })
}


exports.remove_file = function (type, id, cb) {
  storage.do('del', { type: type, id: id }, cb)
}

exports.set_file = function(type, id, opts, cb) {
  logger.debug('Storing command in DB: ' + id);
  storage.do('set', {type: type, id: id, data:  opts }, cb);
}

exports.update_file = function(type, id, key, opts, cb) {
  logger.debug('Storing command in DB: ' + key);
  storage.do('update', { type: type, id: id, columns: opts.columns, values: opts.values }, (err) => {
  })
}

var exist = function(id, cb) {
  var key = ['file', id].join('-');
  exports.get_file_by_id(id, function(err,files) {
    if (err)
      return err.message;
      if (files.length==0) 
      return cb(null, false);
    return cb(null, true);
  });
}

exports.store = function(id, path, size, user, name, resumable) {
  exist(id, function(err, out) {
    if (out == false) {
      logger.debug('Storing file_id in DB: ' + id);
      var opts = {
        id : id,
        path: path,
        size: size,
        user: user,
        name: name,
        resumable: false
      }
      var key = ['file', id].join('-');
      exports.set_file('files',key,opts)
      //storage.set(key, opts);
    }
  });
}

exports.update = function(id, path, size, user, name, resumable, cb) {
  var key = ["file", id].join("-");

  let opts = { columns : ['path','size','user','name','resumable'] , values : [path,size,user,name,!resumable]};

  exports.update_file('files',id,key,opts)
  //storage.update(key, obj_del, obj_add, cb);
}

exports.del = function(id) {
  var key = ['file', id].join('-');
  logger.debug('Removing file_id from DB: ' + id);
  //storage.del(key);
  exports.remove_file('files',key)
}

exports.run_stored = function(host, cb) {
  if (host != 'solid.preyproject.com') return;

  exports.get_files( function(err,files) {
  //storage.do('all', { type: 'files' }, (err, files) => {
  //storage.all('files', function(err, files) {
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

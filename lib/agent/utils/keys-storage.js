var storage  = require('./storage');
var async = require('async');

function store(id, current, cb) {

  async.parallel([
    storage.set([id[0], 'key'].join('-'), { value: current[0] }),
    storage.set([id[1], 'key'].join('-'), { value: current[1] })
  ], cb)
  // var key  = [id, 'key'].join('-'),
  //     opts = { value: current };

  // storage.set(key, opts, cb);
}

function del(id, cb) {
  var key = [id, 'key'].join('-');
  storage.del(key, cb);
}

function update(id, del, add, cb) {
  var key = [id, 'key'].join('-');
  var key_del, key_add,
      obj_del = {}, obj_add = {};

  key_del = { "value": del };
  key_add = { "value": add };
  obj_del[key] = key_del;
  obj_add[key] = key_add;

  storage.update(key, obj_del, obj_add, cb);
}

function get_stored(id, cb) {
  exist(id, function(err, exists, value) {
    if (!exists) return cb(new Error('Doesnt exist'))
    return cb(null, value);
  })

  // storage.all('keys', function(err, db) {
  //   if (err || !db) return cb() && cb(err);
  //   var key = [id, 'key'].join('-');

  //   if (db[key]) {
  //     return cb(null, db[key].value);
  //   } else {
  //     return cb(null, null);
  //   }
  // })
}

function exist(id, cb) {
  var key1 = [id[0], 'key'].join('-');
  var key2 = [id[1], 'key'].join('-');
  
  storage.all('keys', function(err, db) {
    if (err || !db) return cb() && cb(err);

    if (db[key1] && db[key2])
      return cb(null, true, [db[key1].value, db[key2].value]);
    return cb(null, false);
  });
}

exports.store      = store;
exports.del        = del;
exports.update     = update;
exports.exist      = exist;
exports.get_stored = get_stored;
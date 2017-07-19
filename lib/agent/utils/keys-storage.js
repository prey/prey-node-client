var storage  = require('./storage');

function store(id, current, cb) {
  var key  = [id, 'key'].join('-'),
      opts = { value: current };

  storage.set(key, opts, cb);
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
  storage.all('keys', function(err, db) {
    if (err || !db) return cb() && cb(err);
    var key = [id, 'key'].join('-');

    if (db[key]) {
      return cb(null, db[key].value);
    } else {
      return cb(null, null);
    }
  })
}

exports.store      = store;
exports.del        = del;
exports.update     = update;
exports.get_stored = get_stored;
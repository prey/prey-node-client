var storage  = require('./storage');

function store(id, current, cb) {
  var keys = [];
  var current_value = [];

  if (Array.isArray(id)) {
    keys = id;
    current_value = current;
  } else {
    keys.push(id);
    current_value.push(current);
  }

  keys.forEach(function(id_key, index){
    storage.set([id_key, 'key'].join('-'), { value: current_value[index] }, function() {
      if (index == keys.length - 1) return cb();
    });
  });
}

function del(id, cb) {
  var keys = [];
  var current_value = [];

  if (Array.isArray(id)) {
    keys = id;
    current_value = current;
  } else {
    keys.push(id);
    current_value.push(current);
  }

  keys.forEach(function(id_key, index){
    storage.del([id_key, 'key'].join('-'));

    if (index == keys.length - 1) return cb();
  });

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

function exist(id, cb) {
  var keys   = [],
      result = [],
      stored = true;

  if (Array.isArray(id)) keys = id;
  else keys.push(id);
  
  storage.all('keys', function(err, db) {
    if (err || !db) return cb() && cb(err);

    keys.forEach(function(id_key) {
      var key1 = [id_key, 'key'].join('-');
      if (db[key1]) result.push(db[key1].value);
      else stored = false;
    })

    if (stored)
      return cb(null, result);
    return cb(null, null);
  });
}

exports.store      = store;
exports.del        = del;
exports.update     = update;
exports.exist      = exist;
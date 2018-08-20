"use strict";

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

  if (Array.isArray(id)) keys = id;
  else keys.push(id);

  keys.forEach(function(id_key, index){
    storage.del([id_key, 'key'].join('-'));

    if (index == keys.length - 1) return cb();
  });

}

var update = (id, del, add, cb) => {

  return new Promise((resolve, reject) => {
    let key = [id, 'key'].join('-');
    let key_del, key_add,
        obj_del = {}, obj_add = {};

    key_del = { "value": del };
    key_add = { "value": add };
    obj_del[key] = key_del;
    obj_add[key] = key_add;

    storage.update(key, obj_del, obj_add, cb);
  })
}

var exist = (id) => {
  return new Promise((resolve, reject) => {
    var keys   = [],
        result = [];

    if (Array.isArray(id)) keys = id;
    else keys.push(id);
    
    storage.all('keys', (err, db) => {
      if (err || !db) return reject(err);
  
      keys.forEach(id_key => {
        var key1 = [id_key, 'key'].join('-');
        if (db[key1]) {
          if (Array.isArray(id))
            result.push(db[key1].value);
          else result = db[key1].value;
        }
        else result = null;
      })

      return resolve(result);
    });

  })
}

exports.store      = store;
exports.del        = del;
exports.update     = update;
exports.exist      = exist;
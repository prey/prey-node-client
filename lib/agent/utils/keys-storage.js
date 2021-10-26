"use strict";

var storage  = require('./commands_storage');

var store = (id, current, cb) => {
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
   storage.do('set', {type: 'keys', data: {id: [id_key, 'key'].join('-'), value: current_value[index] }} , function(err) {
    if (index == keys.length - 1) return cb();
    });
  });
}

var del = (id, cb) => {
  var keys = [];
  var current_value = [];

  if (Array.isArray(id)) keys = id;
  else keys.push(id);

  keys.forEach(function(id_key, index){
    storage.do('del', {type: 'keys', id: [id_key, 'key'].join('-')});

    if (index == keys.length - 1) return cb();
  });

}

var update = (id, del, add, cb) => {
  var key = [id, 'key'].join('-');
  storage.do('update', { type: 'keys', id: key, columns: 'value', values: add },cb)
  //storage.update(key, obj_del, obj_add, cb);
}

var exist = (id, cb) => {
  let key = [id, 'key'].join('-');

  //storage.all('keys', function(err, db) {
    storage.do('query', {type: 'keys',column : 'id', data: key}, function (err,result) {


    if (err) return cb() && cb(err);
    return cb(null, result);
    //return cb(null, null);
  });
}

exports.store      = store;
exports.del        = del;
exports.update     = update;
exports.exist      = exist;
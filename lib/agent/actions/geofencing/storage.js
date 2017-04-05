var join    = require('path').join,
    common  = require('./../../common'),
    storage = require('./../../utils/storage'),
    logger  = common.logger;

exports.store = function(geofence, cb) {
  var opts = {
    id: geofence.id,
    name: geofence.name,
    state: geofence.state
  }
  var key = ['geofence', opts.id].join('-'),
      obj_add = {};

  obj_add[key] = opts;
  storage.set(key, obj_add, cb);
}

exports.update = function(id, name, del, add, cb) {
  var key = ["geofence", id].join("-");
  
  if (del != add) {
    var fence_del,
        fence_add,
        obj_del = {},
        obj_add = {},

    fence_del = { "id": id, "name": name, "state": del }
    fence_add = { "id": id, "name": name, "state": add }

    obj_del[key] = fence_del;
    obj_add[key] = fence_add;

    storage.update(key, obj_del, obj_add, cb);
  
  } else {
    return cb(null);
  }
}

exports.get_geofences = function(cb) {
  storage.all('geofences', function(err, fences) {
    if (err) cb(new Error("Error retrieving geofences from local database"));

    clear_geo(function(err) {
      if (err) return cb(new Error("Error deleting geofences from local database"), {});
      cb(null, fences);
    });
    
  })
}

var clear_geo = function(cb) {
  storage.clear('geofences', function(err) {
    if (err) logger.error(err.message);
    return cb() && cb(err);
  });
}

exports.clear_geo = clear_geo;


var join    = require('path').join,
    common  = require('./../../common'),
    storage = require('./../../utils/storage'),
    logger  = common.logger;

var storage_path = join(common.system.paths.config, 'commands.db');
storage.init('geofences', storage_path, function(err) {
  if (err) logger.error('Unable to initialize db for geofences: ' + err);
});

exports.store = function(geofence, cb) {
  var opts = {
    id: geofence.id,
    state: geofence.state
  }
  var key = ['geofence', opts.id].join('-'),
      obj = {};

  obj[key] = opts;
  var to_add = new Buffer(JSON.stringify(obj, null, 0)).toString('base64');
  storage.set_geofence(key, to_add, cb);
}

exports.update = function(id, del, add, cb) {
  var key = ["geofence", id].join("-");
  
  if (del != add) {
    var fence_del,
        fence_add,
        obj_del = {},
        obj_add = {},
        to_delete,
        to_add;

    fence_del = {
      "id": id,
      "state": del
    }
    fence_add = {
      "id": id,
      "state": add
    }

    obj_del[key] = fence_del;
    obj_add[key] = fence_add;

    to_delete = new Buffer(JSON.stringify(obj_del, null, 0)).toString('base64');
    to_add    = new Buffer(JSON.stringify(obj_add, null, 0)).toString('base64');

    storage.update(key, to_delete, to_add, cb);
  
  } else {
    return cb(null);
  }
}

exports.get_geofences = function(cb) {
  storage.all('geofences', function(err, fences) {
    if (err) cb(new Error("Error retrieving geofences from database"));

    storage.clear('geofences', function() {
      cb(null, fences);
    });
    
  })
}
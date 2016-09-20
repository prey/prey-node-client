var join    = require('path').join,
    common  = require('./../../common'),
    storage = require('./../../utils/storage'),
    logger  = common.logger;

var storage_path = join(common.system.paths.config, 'commands.db');
storage.init('geofences', storage_path, function(err) {
  if (err) logger.error('Unable to initialize db for geofences: ' + err);
});

exports.store = function(geofence, state, cb) {
  var opts = {
    id: geofence.id,
    state: state
  }
  var key = ['geofence', opts.id].join('-');
  storage.set(key, opts, cb);
}

exports.update = function(id, del, add) {
  var key = ["geofence", id].join("-");
  if (del != add) {
    var fence_del = {
      "id": id,
      "state": del
    }
    var fence_add = {
      "id": id,
      "state": add
    }
    var obj_del = {},
        obj_add = {};

    obj_del[key] = fence_del;
    obj_add[key] = fence_add;

    var to_delete = new Buffer(JSON.stringify(obj_del, null, 0)).toString('base64');
    var to_add = new Buffer(JSON.stringify(obj_add, null, 0)).toString('base64');

    storage.update(to_delete, to_add);
  }
}

exports.get_geofences = function(cb) {
  var geofences = [];
  storage.all('geofences', function(err, fences) {
    if (err) logger.error("There was an error trying to retrieve geofences")
    for (key in fences) {
      geofences.push(fences[key])
    }
    storage.clear('geofences');
  })
}
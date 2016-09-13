var join    = require('path').join,
    common  = require('./../../common'),
    storage = require('./../../utils/storage'),
    logger  = common.logger;

var storage_path = join(common.system.paths.config, 'commands.db');
storage.init('geofences', storage_path, function(err) {
  if (err) logger.error('Unable to initialize db for geofences: ' + err);
});

exports.store = function(geofence, state) {
  var opts = {
    id: geofence.id,
    state: state
  }
  var key = ['geofence', opts.id].join('-');
  storage.set(key, opts);
}

exports.get_geofences = function(cb) {
  var geofences = [];
  storage.all('geofences', function(err, fences) {
    if (err) logger.error("There was an error trying to retrieve geofences")
    for (key in fences) {
      geofences.push(fences[key])
    }
    storage.clear('geofences');
    cb(null, geofences)
  })
}
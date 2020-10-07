"use strict";

var EventEmitter = require('events').EventEmitter,
    logger       = require('./../../common').logger.prefix('geofencing'),
    api          = require('./../../plugins/control-panel/api'),
    hooks        = require('./../../hooks'),
    storage      = require('./storage');

var emitter;

function fetch_geofences(cb) {
  api.devices.get.geofences(cb);
}

exports.sync = function(geofences) {
  var len = geofences.length,
      watching = [];

  if (len === 0) {
    storage.clear_geo(function(err) {
      if (err) logger.error("Error deleting geofences from local database")
      done();
    })

  } else {
    storage.get_geofences(function(err, stored_geofences) {
      if (err || !stored_geofences) stored_geofences = {};

      geofences.forEach(function (geofence, index) {
        var geo = "geofence-" + geofence.id;

        // The previous state it's reassignated
        if (stored_geofences[geo])
          geofence.state = stored_geofences[geo].state;        
        else
          watching.push(geofence.id);

        storage.store(geofence, function(err) {
          if (err) logger.error("Error storing geofences: " + err);

          // The watcher starts only after the last fence it's saved...
          if (index == geofences.length - 1) {
            if (watching.length > 0) {
              start_watcher(geofences, done);
            } else return done();
          }
        });
      });
    });
  }

  function start_watcher(geofences, cb) {
    notify_done();

    function notify_done() {
      var data = {
        status: 'started',
        command: 'start',
        target: 'geofencing',
        reason: JSON.stringify(watching)
      }
      api.push['response'](data);
      cb();
    }
  }

  function done() {
    hooks.trigger('geofencing_start', geofences);
    return emitter.emit('end');
  }

}

function refresh_geofences(opts, cb) {

  emitter = emitter || new EventEmitter();

  fetch_geofences(function(err, res) {
    if (err) return emitter.emit('end', err);

    var geofences = res.body;

    if (!(geofences instanceof Array)) {
      var err = new Error('Geofences list is not an array');
      return emitter.emit('end', err)
    }
    exports.sync(geofences);
  });

  cb && cb(null, emitter);
}

exports.start = exports.stop = refresh_geofences;
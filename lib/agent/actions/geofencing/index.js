"use strict";

var EventEmitter = require('events').EventEmitter,
    logger  = require('./../../common').logger.prefix('geofencing'),
    api     = require('./../../plugins/control-panel/api'),
    watcher = require('./../../triggers/geofencing'),
    storage = require('./storage');

var emitter;

function fetch_geofences(cb) {
  api.devices.get.geofences(cb);
}

function sync(geofences) {
  var len = geofences.length,
      count = 0,
      watching = [];

  if (len === 0) {
    storage.clear_geo(function(err) {
      if (err) logger.error("Error deleting geofences from local database")
      watcher.stop(done);
    })
  } else {
    storage.get_geofences(function(err, stored_geofences) {
      if (err) stored_geofences = {};
      
      geofences.forEach(function (geofence) {
        var geo = "geofence-" + geofence.id;

        //if the geofence has a previous state it's reassignated
        if (stored_geofences[geo]) {
          geofence.state = stored_geofences[geo].state;        
        }

        storage.store(geofence, function(err) {
          if (err) logger.error("Error storing geofences: " + err);
        });
      });

      start_watcher(geofences, done);
    });
  }

  function start_watcher(geofences, cb) {
    watcher.start(geofences, function(err, fence) {
      // callback is called each time a geofence starts being watched
      if (!err) {
        watching.push(fence.id);
        add_listener(fence);
      }
      count++;
      notify_if_done();
    });

    function notify_if_done() {
      if (!(count === len)) return;

      var data = {
        status: 'started',
        command: 'start',
        target: 'geofencing',
        reason: JSON.stringify(watching)
      }
      api.push['response'](data);
      cb();
    }

    function add_listener(fence) {
      // Event format is the following:
      //{name=geofencing_in, info={"id":9,"lat":"-33.4220056","lng":"-70.6117321","accuracy":"30.0","method":"native"}}

      fence.on('entered_geofence', function(coords) {
        push_event('geofencing_in', coords);
      });
      fence.on('left_geofence', function(coords) {
        push_event('geofencing_out', coords);
      });

      function push_event(type, coords) {
        coords.id = fence.id;
        var data = {
          name: type,
          info: JSON.stringify(coords)
        }
        api.push['event'](data);
      }
    }
  }

  function done() {
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

    sync(geofences);
  });

  cb && cb(null, emitter);
}

exports.start = exports.stop = refresh_geofences;
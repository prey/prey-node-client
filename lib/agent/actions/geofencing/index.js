"use strict";

var EventEmitter = require('events').EventEmitter,
    api = require('./../../plugins/control-panel/api'),
    watcher = require('./../../triggers/geofencing');

function fetch_geofences(cb) {
  api.devices.get.geofences(cb);
}

function start_watching(geofences) {
  var len = geofences.length,
      count = 0,
      watching = [];

  watcher.start({locations: geofences}, function(err, fence) {
    if (!err) watching.push(fence.id);
    count++;
    notify_if_done();
  });

  function notify_if_done() {
    if (!(count === len)) return;
    var data = {
      status: 'started',
      command: 'start',
      target: 'geofencing',
      reason: watching
    }

    api.push['response'](data);
  }
}

function stop_watching() {}

exports.start = function(opts, cb) {

  var emitter = new EventEmitter();

  fetch_geofences(function(err, res) {
    if (err) return emitter.emit('end', err);

    var geofences = res.body;

    console.log(geofences);

    if (!(geofences instanceof Array)) {
      var err = new Error('Geofences list is not an array');
      return emitter.emit('end', err)
    }

    //console.log(res.body);

    if (geofences.length > 0) {
      start_watching(geofences);
    }
  });

  cb(null, emitter);
}

exports.stop = function(opts, cb) {}

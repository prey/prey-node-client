"use strict";

var async        = require('async'),
    EventEmitter = require('events').EventEmitter,
    logger       = require('./../../common').logger.prefix('geofencing'),
    api          = require('./../../plugins/control-panel/api'),
    hooks        = require('./../../hooks');

var new_storage = require('./../../utils/commands_storage');
var emitter;

exports.watching;

function fetch_geofences(cb) {
  api.devices.get.geofences(cb);
}

exports.get_geofences = function (cb) {
  new_storage.do('all', { type: 'geofences' }, (err, stored_geofences) => {
    if (err) return cb(new Error ('Error retrieving geonfences from local database'))
    return cb(null, stored_geofences);
  })
}

exports.sync = function(geofences, cb) {
  exports.watching = [];

  let fences = geofences;

  // Se obtienen las zonas locales almacenadas
  new_storage.do('all', { type: 'geofences' }, (err, stored_geofences) => {
    let array = [];

    // Por cada stored fence se revisa si existe en el listado nuevo
    stored_geofences.forEach((stored_fence) => {
      array.push((callback) => {
        let occurrences = geofences.filter(x => x.id == stored_fence.id);
          
        // Si la zona existe se asigna el state y se quita del listado de nuevas...
        if (occurrences.length > 0) {
          let geof_index = geofences.findIndex((obj => obj.id == stored_fence.id));
          geofences[geof_index].state = stored_fence.state;

          // se quita de fences
          fences = fences.filter(x => x.id != stored_fence.id)
          exports.watching.push(parseInt(stored_fence.id));
          callback();
          //Si no existe en el listado nuevo se borra del local, se quita del listado de nuevas...
        } else {
          // se quita de las zonas locales
          new_storage.do('del', {type: 'geofences', id: stored_fence.id}, callback);
        }
      })
    })

    async.series(array, (err) => {
      let array2 = [];

      // al terminar.. de las nuevas (fences) que queden se agregan todas en el listado local
      fences.forEach(fence => {
        array2.push((callback) => {
          exports.watching.push(parseInt(fence.id));
          new_storage.do('set', {type: 'geofences', id: fence.id, data: {name: fence.name, state: 'NULL'}}, callback)
        }) 
      })

      async.series(array2, (err) => {
        start_watcher(() => {
          done(cb);
        });
      });
    });
  });

  function start_watcher(cb) {
    notify_done();

    function notify_done() {
      var data = {
        status: 'started',
        command: 'start',
        target: 'geofencing',
        reason: JSON.stringify(exports.watching)
      }
      api.push['response'](data);
      cb();
    }
  }

  function done(cb) {
    hooks.trigger('geofencing_start', geofences);
    emitter.emit('end');
    return cb();
  }

}

function refresh_geofences(id, opts, cb) {

  emitter = emitter || new EventEmitter();

  fetch_geofences(function(err, res) {
    if (err || !res || !res.body) {
      emitter.emit('end', err);
      return cb(new Error("Unable to get geofences from control panel"));
    }

    var geofences = res.body;

    if (!(geofences instanceof Array)) {
      var err = new Error('Geofences list is not an array');
      return emitter.emit('end', err)
    }
    exports.sync(geofences, () => {
      cb && cb(null, emitter);
    });
  });
  
}

exports.start = exports.stop = refresh_geofences;
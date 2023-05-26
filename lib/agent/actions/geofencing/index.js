const { EventEmitter } = require('events');
const async = require('async');
const api = require('../../plugins/control-panel/api');
const storage = require('../../utils/storage');
const hooks = require('../../hooks');
// var async        = require('async'),
//     EventEmitter = require('events').EventEmitter,
//     api          = require('./../../plugins/control-panel/api'),
//     storage      = require('./../../utils/storage'),
//     hooks        = require('./../../hooks');

let emitter;

exports.watching;

function fetch_geofences(cb) {
  api.devices.get.geofences(cb);
}

exports.get_geofences = function (cb) {
  storage.do('all', { type: 'geofences' }, (err, storedGeofences) => {
    if (err || !storedGeofences) return cb(new Error ('Error retrieving geofences from local database'))
    return cb(null, storedGeofences);
  });
};

exports.sync = function(id, geofences, cb) {
  exports.watching = [];
  if (geofences.length === 0) return cb && cb();
  let fences = geofences;

  // Se obtienen las zonas locales almacenadas
  storage.do('all', { type: 'geofences' }, (err, storedGeofences) => {
    if (err || !storedGeofences) return cb(new Error('Error retrieving geofences from local database'));
    if (storedGeofences.length === 0 && geofences.length === 0) return cb && cb();
    let array = [];
    // Por cada stored fence se revisa si existe en el listado nuevo
    storedGeofences.forEach((storedFence) => {
      array.push((callback) => {
        const occurrences = geofences.filter((x) => x.id == storedFence.id);
        // Si la zona existe se asigna el state y se quita del listado de nuevas...
        if (occurrences.length > 0) {
          const geofIndex = geofences.findIndex(((obj) => obj.id == storedFence.id));
          geofences[geofIndex].state = storedFence.state;

          // se quita de fences
          fences = fences.filter((x) => x.id != storedFence.id);
          exports.watching.push(parseInt(storedFence.id, 10));
          callback();
          // Si no existe en el listado nuevo se borra del local, se quita del listado de nuevas...
        } else {
          // se quita de las zonas locales
          storage.do('del', { type: 'geofences', id: storedFence.id }, callback);
        }
      });
    });
    async.series(array, () => {
      let array2 = [];

      // al terminar.. de las nuevas (fences) que queden se agregan todas en el listado local
      fences.forEach((fence) => {
        array2.push((callback) => {
          exports.watching.push(parseInt(fence.id, 10));
          storage.do('set', {type: 'geofences', id: fence.id, data: { name: fence.name, state: 'NULL' } }, callback);
        });
      });

      async.series(array2, () => {
        start_watcher(() => {
          done(id, cb);
        });
      });
    });
  });

  function start_watcher(cb) {
    if (exports.watching && exports.watching.length > 0) {
      notify_done();
    }

    function notify_done() {
      const data = {
        status: 'started',
        command: 'start',
        target: 'geofencing',
        reason: JSON.stringify(exports.watching),
      };
      api.push.response(data);
      cb();
    }
  }

  function done(idDone, cb) {
    hooks.trigger('geofencing_start', geofences);
    setTimeout(() => {
      emitter.emit('end', idDone);
    }, 1000);
    return cb();
  }
}

function refresh_geofences(id, opts, cb) {
  emitter = emitter || new EventEmitter();
  fetch_geofences((err, res) => {
    if (err || !res || !res.body) {
      emitter.emit('end', id, err);
      if (cb && typeof (cb) === 'function') return cb(new Error('Unable to get geofences from control panel'));
      return null;
    }
    const geofences = res.body;

    if (!(geofences instanceof Array)) {
      const error = new Error('Geofences list is not an array');
      return emitter.emit('end', id, error);
    }
    exports.sync(id, geofences, () => cb && cb(null, emitter));
  });
}

exports.start = exports.stop = refresh_geofences;
"use strict"

var triggers    = require('os-triggers'),
    path        = require('path'),
    Emitter     = require('events').EventEmitter,
    common      = require('../../../common'),
    storage     = require('./../../utils/storage'),
    base_path   = path.join(__dirname, '..', '..'),
    hooks       = require(path.join(base_path, 'hooks')),
    providers   = require(path.join(base_path, 'providers')),
    logger      = common.logger.prefix('hostname');
  
var emitter,
    checking = false,
    connection_status,
    pending_data;

var get_current_hostname = () => {
  return new Promise((resolve, reject) => {
    providers.get('current_hostname', (err, current) => {
      if (err) return reject(err);
      resolve(current);
    })
  })
}

var emit_event = (data) => {
  if (connection_status && connection_status == 'connected') {
    emitter.emit('device_renamed', JSON.stringify(data));
    pending_data = null;
  }
  else {
    pending_data = data;
  }
}

var check_hostname = () => {
  if (checking) return;
  checking = true;

  var done = (err) => {
    if (err) logger.error(err.message);
    checking = false;
    return;
  }

  get_current_hostname()
  .then(current_name => {
    storage.do('query', {type: 'keys', column: 'id', data: 'hostname'}, (err, stored) => {
      if (err) return done(new Error('Error checking stored hostname'));
      if (stored && stored.length > 0) {
        let stored_name = stored[0].value;
        if (current_name == stored_name) return done();
        logger.warn(`Device hostname changed from ${stored_name} to ${current_name}`)

        storage.do('update', { type: 'keys', id: 'hostname', columns: 'value', values: current_name }, (err) => {
          if (err) return done(new Error("Error updating hostname"));

          let data = {
            old_name: stored_name,
            new_name: current_name
          }
          emit_event(data);
          return done();
        })

      } else storage.do('set', {type: 'keys', id: 'hostname', data: {value: current_name}}, (err) => { done(err) });
    });
  })
  .catch(error => { return done(new Error('Unable to get device current hostname')) })

}

exports.start = (opts, cb) => {
  hooks.on('connected', () => {
    connection_status = 'connected';
    if (pending_data) emit_event(pending_data);
  })

  hooks.on('disconnected', () => {
    connection_status = 'disconnected';
  })

  setTimeout(() => {
    triggers.watch('hostname', (err, hostname) => {
      if (err) return cb(err);
      hostname.on('state_changed', (info) => {
        check_hostname();
      });

      check_hostname();
      emitter = new Emitter();
      cb(null, emitter);
    })
  }, 1000);
};

exports.stop = () => {
  triggers.unwatch('hostname');
  hooks.remove('connected');
  hooks.remove('disconnected');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = ['device_renamed'];
exports.check_hostname = check_hostname
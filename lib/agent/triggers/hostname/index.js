"use strict"

var triggers    = require('os-triggers'),
    path        = require('path'),
    Emitter     = require('events').EventEmitter,
    common      = require('./../../common'),
    device_keys = require('./../../utils/keys-storage'),
    base_path   = path.join(__dirname, '..', '..'),
    providers   = require(path.join(base_path, 'providers')),
    logger      = common.logger.prefix('hostname');
  
var emitter,
    checking = false;

var get_current_hostname = () => {
  return new Promise((resolve, reject) => {
    providers.get('current_hostname', (err, current) => {
      if (err) return reject(err);
      resolve(current);
    })
  })
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
  .catch(error => { return done(new Error('Unable to get device current hostname')) })
  .then(current_name => {
    device_keys.exist('hostname', (err, stored) => {
      if (err) return done(new Error('Error checking stored hostname'));
      if (stored) {
        let stored_name = stored[0];
        if (current_name == stored_name) return done();
        logger.warn(`Device hostname changed from ${stored_name} to ${current_name}`)
        device_keys.update('hostname', stored_name, current_name, function(err) {
          if (err) return done(new Error("Error updating hostname"));

          let data = {
            old_name: stored_name,
            new_name: current_name
          }
          emitter.emit('device_renamed', JSON.stringify(data));
          return done();
        })

      } else device_keys.store('hostname', current_name, (err) => { done(err) });
    });
  })

}

exports.start = (opts, cb) => {
  triggers.watch('hostname')
  .catch(error => { return cb(error); })
  .then((hostname) => {
    hostname.on('state_changed', (info) => {
      check_hostname();
    });
    emitter = new Emitter();
    cb(null, emitter);

    check_hostname();
  })
};

exports.stop = () => {
  triggers.unwatch('hostname');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = ['device_renamed'];

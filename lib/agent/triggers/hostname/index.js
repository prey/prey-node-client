"use strict"

var triggers    = require('triggers'),
    path        = require('path'),
    Emitter     = require('events').EventEmitter,
    common      = require('./../../common'),
    device_keys = require('./../../utils/keys-storage'),
    base_path   = path.join(__dirname, '..', '..'),
    providers   = require(path.join(base_path, 'providers')),
    logger      = common.logger.prefix('hostname');
  
var emitter,
    checking = false;

// Just for QA purposes ////////////////////////
var toaster = require('./../../utils/toaster');
var toast_opts = {
  title: 'Prey',
  message: 'Le cambiaste el nombre a tu device oe, revisa el panel!'
}
////////////////////////////////////////////////

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
  }

  get_current_hostname()
  .catch(error => { return done(new Error('Unable to get device current hostname')) })
  .then(current_name => {

    device_keys.exist('hostname')
    .catch(error => { return done(new Error('Error checking stored hostname')) })
    .then(stored_name => {
      if (stored_name) {

        if (current_name == stored_name) return done();
        
        toaster.notify(toast_opts);
        logger.warn(`Device hostname changed from ${stored_name} to ${current_name}`)
        device_keys.update('hostname', stored_name, current_name, function(err) {
          if (err) return done(new Error("Error updating hostname"));

          emitter.emit('device_renamed', { old_name: stored_name, new_name: current_name });
          return done();
        })

      } else device_keys.store('hostname', current_name, (err) => { done(err) });
    })
  })

}

exports.start = (opts, cb) => {
  check_hostname();
  
  triggers.watch('hostname')
  .catch(error => { return cb(error); })
  .then((hostname) => {
    hostname.on('state_changed', (info) => {
      check_hostname();
    });

    emitter = new Emitter();
    cb(null, emitter);
  })
};

exports.stop = () => {
  triggers.unwatch('hostname');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.check_hostname = check_hostname;
exports.events = ['device_renamed'];

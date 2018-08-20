"use strict"

var triggers    = require('triggers'),
    cp          = require('child_process'),
    Emitter     = require('events').EventEmitter,
    common      = require('./../../common'),
    logger      = common.logger.prefix('hostname'),
    device_keys = require('./../../utils/keys-storage'),
    api         = require('./../../plugins/control-panel/api');

var emitter,
    checking = false;

var push_event = (old_name, new_name) => {
  console.log("PUSH EVENT!!!!!")
  let data = {
    name: 'device_renamed',
    info: {
      old_name: old_name,
      new_name: new_name
    }
  }
  let opts = { json: true };
  api.push['event'](data, opts);
}

var get_current_hostname = () => {
  return new Promise((resolve, reject) => {
    cp.exec('scutil --get LocalHostName', (err, stdout) => {
      console.log("STDOUT!!!", stdout)
      if (err) return reject(err);
      resolve(stdout.split('\n')[0]);
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
  .catch(error => { return done(new Error(`Unable to get device current hostname: ${error}`)) })
  .then(current_name => {

    device_keys.exist('hostname')
    .catch(error => { return done(new Error(`Error checking stored hostname: ${error}`)) })
    .then(stored_name => {
      if (stored_name) {

        if (current_name == stored_name) return done();
          
        logger.warn(`Device hostname changed from ${stored_name} to ${current_name}`)
        device_keys.update('hostname', stored_name, current_name, function(err) {
          if (err) return done(new Error("Error updating hostname"));
          exports.push_event(stored_name, current_name);
        })

      } else device_keys.store('hostname', current_name, (err) => { done(err) });
    })
  })

}

exports.start = (opts, cb) => {
  check_hostname();
  triggers.watch('hostname', { respawn: true })
    .then((hostname) => {
      hostname.on('state_changed', (info) => {
        check_hostname();
      });

      emitter = new Emitter();
      cb(null, emitter);
    })
    .catch(error => {})

};

exports.stop = () => {
  triggers.unwatch('hostname');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.push_event = push_event;
exports.check_hostname = check_hostname;
exports.events = [];

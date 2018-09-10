"use strict"

var triggers  = require('triggers'),
    join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks = require(join(base_path, 'hooks')),
    exec = require('child_process').exec,
    os_name   = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    is_mac = os_name == 'mac',
    toaster   = require('./../../utils/toaster'),
    Emitter   = require('events').EventEmitter;

var emitter,
    previous = null,
    checking = false;

var common    = require('./../../common'),
    logger    = common.logger.prefix('system');

var toast_opts = {
  title: 'Prey',
  message: 'Habeis Despertado a la presa',
}

var get_current_state = (cb) => {
  if (is_mac) {
    let cmd = `pmset -g log|grep -e " Sleep  " -e " Wake  "|tail -n 1 |awk '{print $4}'`;
    exec(cmd, (err, state) => {
      if (err) return cb(err);

      state = state.trim();
      let current = false;
      
      if (state == "Sleep")
        current = true;

      return cb(null, current);
    });

  } else return cb(new Error('No info available'));
}

var check_and_emit = (info) => {
  logger.info("CHECK AND EMIT!! " + info)
  if (checking) return;
  checking = true;

  var done = (err, current) => {
    if (err) logger.warn("ERROR!", err.message)

    if (previous != current) {
      if (current == false) toaster.notify(toast_opts);
      hooks.trigger('sleep_state_changed', current);
    }
    
    previous = current;
    checking = false;
  }

  if (info) {
    let current = (info == 'true');
    return done(null, current);
  }

  get_current_state((err, current) => {
    if (err) return done(err);
    return done(null, current);
  })
};

exports.start = function(opts, cb){

  triggers.watch('system', { respawn: true })
    .catch(error => { return cb(error); })
    .then((system) => {

      // For mac and linux
      system.on('state_changed', (info) => {
        check_and_emit(info);
      });
     
      // For windows
      system.on('suspended', (info) => {
        check_and_emit('true');
      });
      system.on('unsuspended', (info) => {
        check_and_emit(info);
      });
      system.on('resumed', (info) => {
        check_and_emit('false');
      });

      emitter = new Emitter();
      cb(null, emitter);
    });
};

exports.stop = () => {
  triggers.unwatch('system');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = [];
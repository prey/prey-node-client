var triggers  = require('os-triggers'),
    join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    osName   = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    status    = require('./../status'),
    providers = require(join(base_path, 'providers')),
    Emitter   = require('events').EventEmitter;

var emitter,
    attempt = 0,
    checking = false,
    previous = {};

var check_battery_status = (first) => {

  providers.get('battery_status', (err, current) => {
    if (err || !emitter) return;

    // console.log('Current: ' + current.state);
    // console.log('Previous: ' + previous.state);

    if (first) return previous = current;

    // On mac we check 4 more times the battery status because of the realization time.
    if ((previous.state == current.state || (previous.state != 'discharging' && current.state != 'discharging')) && osName == 'mac') {
      if (attempt == 4) {
        checking = false;
        attempt = 0;
        return;
      }
      attempt ++;
      return setTimeout(check_battery_status, 4000);
    }

    checking = false;
    attempt = 0;
    // Update battery status for next request
    status.set_status('battery_status', current)

    if ((previous.state == 'discharging' || !previous.state) && current.state != 'discharging') {
      if (previous.state) emitter.emit('started_charging');
    }

    else if (current.state == 'discharging' && (previous.state != 'discharging' || !previous.state)) {
      if (previous.state) emitter.emit('stopped_charging');
    }

    previous = current;
  });

};

exports.start = (opts, cb) => {

  triggers.watch('power', (err, power) => {
    if (err) return cb(err);

    power.on('state_changed', (info) => {
      if (checking) return;
      checking = true;
      setTimeout(check_battery_status, 2000);
    });

    check_battery_status(true);
    emitter = new Emitter();
    cb(null, emitter);
  });

};

exports.stop = () => {
  triggers.unwatch('power');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = [ 'low_battery', 'started_charging', 'stopped_charging' ];

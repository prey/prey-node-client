var triggers  = require('os-triggers'),
    join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    providers = require(join(base_path, 'providers')),
    hooks     = require(join(base_path, 'hooks')),
    Emitter   = require('events').EventEmitter;

var emitter,
    previous = {};

var check_battery_status = () => {

  providers.get('battery_status', (err, current) => {
    if (err || !emitter) return;

    // console.log('Current: ' + current.state);
    // console.log('Previous: ' + previous.state);

    if (current.state == 'charging' && previous.state != 'charging')
      emitter.emit('started_charging');
    else if (current.state == 'discharging' && previous.state != 'discharging')
      emitter.emit('stopped_charging');

    previous = current;
  });

};

exports.start = (opts, cb) => {

  triggers.watch('power')
    .catch(error => { return cb(error); })
    .then((power) => {
      power.on('state_changed', (info) => {
        setTimeout(check_battery_status, 1500);
        hooks.trigger('power_changed');
      });

      power.on('low_power', (info) => {
        emitter.emit('low_battery');
      });

      emitter = new Emitter();
      cb(null, emitter);
    })
};

exports.stop = () => {
  triggers.unwatch('power');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = [ 'low_battery', 'started_charging', 'stopped_charging' ];

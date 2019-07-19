var triggers  = require('os-triggers'),
    join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    providers = require(join(base_path, 'providers')),
    Emitter   = require('events').EventEmitter;

var emitter,
    previous = {};

var check_battery_status = () => {

  providers.get('battery_status', (err, current) => {
    if (err || !emitter) return;

    // console.log('Current: ' + current.state);
    // console.log('Previous: ' + previous.state);

    if ((current.state == 'charging' || current.state == 'charged') && previous.state != 'charging' && previous.state != 'charged')
      emitter.emit('started_charging');
    else if (current.state == 'discharging' && previous.state != 'discharging')
      emitter.emit('stopped_charging');

    previous = current;
  });

};

exports.start = (opts, cb) => {

  triggers.watch('power', function(err, power) {
    if (err) return cb(err);

    power.on('state_changed', function(info){
      setTimeout(check_battery_status, 7000);
    });

    power.on('low_power', function(info){
      emitter.emit('low_battery');
    });

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

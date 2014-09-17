var triggers  = require('triggers'),
    providers = require('./../../providers'),
    Emitter   = require('events').EventEmitter;

var emitter,
    previous = {};

var check_battery_status = function() {

  providers.get('battery_status', function(err, current){
    if (err) return;

    // console.log('Current: ' + current.state);
    // console.log('Previous: ' + previous.state);

    if (current.state == 'charging' && previous.state != 'charging')
      emitter.emit('started_charging');
    else if (current.state == 'discharging' && previous.state != 'discharging')
      emitter.emit('stopped_charging');

    previous = current;
  });

};

exports.start = function(opts, cb){

  triggers.watch('power', { respawn: true }, function(err, power){
    if (err) return cb(err);

    power.on('state_changed', function(info){
      check_battery_status(info);
    });

    power.on('low_power', function(info){
      emitter.emit('low_battery');
    });

    emitter = new Emitter();
    cb(null, emitter);
  });

};

exports.stop = function(){
  triggers.unwatch('power');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = [ 'low_battery', 'started_charging', 'stopped_charging' ];

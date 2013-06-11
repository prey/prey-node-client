var triggers  = require('triggers'),
    providers = require('./../../providers'),
    Emitter   = require('events').EventEmitter;

var emitter,
    previous = {};

var check_battery_status = function() {

  providers.get('battery_status', function(err, data){
    if (err) return;

    if (data.state == 'charging' && previous.state != 'charging')
      emitter.emit('started_charging');
    else if (data.state == 'discharging' && previous.state != 'discharging')
      emitter.emit('stopped_charging');

    previous = data;
  });

};

exports.start = function(opts, cb){

  triggers.watch('power', function(err, power){
    if (err) return cb(err);

    power.on('state_changed', function(info){
      check_battery_status(info);
    });

    power.on('low_power', function(info){
      emitter.emit('low_power');
    });

    emitter = new Emitter();
    cb(null, emitter);
  });

};

exports.stop = function(){
  triggers.unwatch('power');
};

exports.events = [ 'low_power', 'started_charging', 'stopped_charging' ];

var triggers  = require('triggers'),
    providers = require('./../../providers'),
    Emitter   = require('events').EventEmitter;

var emitter,
    current = {};

var check_if_changed = function(field, event) {

  providers.get(field, function(err, data){
    if (err) return;

    if (current[field] != data)
      emitter.emit(event, data);

    current[field] = data;
  });

};

exports.start = function(opts, cb){

  triggers.watch('network', function(err, network){
    if (err) return cb(err);

    network.on('state_changed', function(info){
      check_if_changed('active_access_point_name', 'ssid_changed');
      check_if_changed('private_ip', 'private_ip_changed');
    });

    emitter = new Emitter();
    cb(null, emitter);
  });

};

exports.stop = function(){
  triggers.unwatch('network');
};

exports.events = [ 'ssid_changed', 'private_ip_changed' ];

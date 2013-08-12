var triggers  = require('triggers'),
    providers = require('./../../providers'),
    Emitter   = require('events').EventEmitter;

var emitter,
    current  = {},
    checking = {};

var get_current = function(list){
  list.forEach(function(field){
    providers.get(field, function(err, data){
      // console.log(field + ' -> ' + data);
      current[field] = data;
    })
  })
}

var check_if_changed = function(field, event) {
  if (checking[field]) return;

  checking[field] = true;
  providers.get(field, function(err, data){
    // console.log(field + ' -> ' + data);
    if (current[field] != data)
      emitter.emit(event, data);

    current[field]  = data;
    checking[field] = false;
  });
};

exports.start = function(opts, cb){

  triggers.watch('network', { respawn: true }, function(err, network){
    if (err) return cb(err);

    network.on('state_changed', function(info){
      setTimeout(function(){
        check_if_changed('active_access_point_name', 'ssid_changed');
        check_if_changed('private_ip', 'private_ip_changed');
      }, 200); // wait a sec so IP gets assigned
    });

    emitter = new Emitter();
    cb(null, emitter);
  });

  get_current(['active_access_point_name', 'private_ip']);
};

exports.stop = function(){
  triggers.unwatch('network');
};

exports.events = [ 'ssid_changed', 'private_ip_changed' ];

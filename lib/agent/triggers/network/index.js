var triggers  = require('triggers'),
    join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks     = require(join(base_path, 'hooks')),
    providers = require(join(base_path, 'providers')),
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

  var done = function(err) {
    checking[field] = false;
  }

  checking[field] = true;
  providers.get(field, function(err, data) {
    // emitter may be null if trigger is stopped while getting data
    if (err || !data || !emitter) return done(err);

    // console.log(field + ' -> ' + data);
    if (current[field] != data)
      emitter.emit(event, data);

    current[field]  = data;
    done()
  });
};

exports.start = function(opts, cb){

  triggers.watch('network', { respawn: true }, function(err, network){
    if (err) return cb(err);

    network.on('state_changed', function(info) {
      setTimeout(function(){
        hooks.trigger('network_state_changed'); // for connection watcher

        check_if_changed('active_access_point_name', 'ssid_changed');
        check_if_changed('private_ip', 'private_ip_changed');
      }, 200); // wait a sec so IP gets assigned
    });

    emitter = new Emitter();
    cb(null, emitter);
  });

  // get current SSID name and private ip so we can compare afterwards
  get_current(['active_access_point_name', 'private_ip']);
};

exports.stop = function(){
  triggers.unwatch('network');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = [ 'ssid_changed', 'private_ip_changed' ];

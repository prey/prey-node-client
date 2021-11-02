var triggers  = require('os-triggers'),
    join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks     = require(join(base_path, 'hooks')),
    providers = require(join(base_path, 'providers')),
    provider  = require(join(base_path, 'providers', 'network')),
    Emitter   = require('events').EventEmitter;

var emitter,
    current  = {},
    checking = {};

var get_current = (list) => {
  list.forEach(field => {
    providers.get(field, (err, data) => {
      current[field] = data;
    })
  })
}

var check_if_changed = (field, event) => {

  if (checking[field] || !current[field]) return;

  var done = (err) => {
    checking[field] = false;
  }

  checking[field] = true;
  providers.get(field, (err, data) => {
    // emitter may be null if trigger is stopped while getting data
    if (err || !data || !emitter) return done(err);

    if (current[field] != data)
      emitter.emit(event, data);

    current[field]  = data;
    done()
  });
};

exports.start = (opts, cb) => {
  setTimeout(() => {
    triggers.watch('network', (err, network) => {
      if (err) return cb(err);

      network.on('state_changed', function(info) {
        setTimeout(() => {
          hooks.trigger('network_state_changed'); // for connection watcher

          check_if_changed('private_ip', 'private_ip_changed');
          check_if_changed('public_ip', 'public_ip_changed');
        }, 200); // wait a sec so IP gets assigned
      });

      hooks.on('connected', () => {
        setTimeout(() => {
          check_if_changed('active_access_point_name', 'ssid_changed');
          check_if_changed('active_access_point_mac', 'mac_address_changed');
        }, 500) // wait for an updated data query
      });

      emitter = new Emitter();
      cb(null, emitter);
    });
    get_current(['active_access_point_name', 'private_ip', 'active_access_point_mac', 'public_ip']);
  }, 500);
  // get current SSID name and private ip so we can compare afterwards
};

exports.stop = () => {
  triggers.unwatch('network');
  hooks.remove('connected');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = [ 'ssid_changed', 'private_ip_changed', 'mac_address_changed', 'public_ip_changed'];

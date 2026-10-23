// @ts-check
// hooks is cast to any: it exposes custom trigger/remove methods on top of EventEmitter.
var triggers  = require('os-triggers'),
    join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks     = /** @type {any} */ (require(join(base_path, 'hooks'))),
    providers = require(join(base_path, 'providers')),
    provider  = require(join(base_path, 'providers', 'network')),
    osName    = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    Emitter   = require('events').EventEmitter;

var emitter,
    current  = {},
    checking = {};

var get_current = (list) => {
  list.forEach(field => {
    providers.get(field, (err, data) => {
      // console.log(field + ' -> ' + data);
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

    // console.log(field + ' -> ' + data);
    if (current[field] != data)
      emitter.emit(event, data);

    current[field]  = data;
    done()
  });
};

// Named so stop() removes only this listener: hooks.remove('connected') without a
// function would also wipe every other module's 'connected' listeners.
const handleConnected = () => {
  setTimeout(() => {
    check_if_changed('active_access_point_name', 'ssid_changed');
    check_if_changed('active_access_point_mac', 'mac_address_changed');
  }, 500) // wait for an updated data query
};

/**
 * @param {*} opts
 * @param {(err: Error|null, emitter?: *) => void} cb
 */
exports.start = (opts, cb) => {
  setTimeout(() => {
    // WiFi state monitoring (Linux only)
    if (osName === 'linux') {
      triggers.watch('wifi', (err, wifi) => {
        if (err) return cb(err);

        wifi.on('state_changed', function(info) {
          hooks.trigger('wifi_state_changed');
        });
      });
    }

    triggers.watch('network', (err, network) => {
      if (err) return cb(err);

      network.on('state_changed', function(info) {
        setTimeout(() => {
          hooks.trigger('network_state_changed'); // for connection watcher

          check_if_changed('private_ip', 'private_ip_changed');
          check_if_changed('public_ip', 'public_ip_changed');
        }, 200); // wait a sec so IP gets assigned
      });

      hooks.remove('connected', handleConnected);
      hooks.on('connected', handleConnected);

      emitter = new Emitter();
      cb(null, emitter);
    });
    get_current(['active_access_point_name', 'private_ip', 'active_access_point_mac', 'public_ip']);
  }, 500);
  // get current SSID name and private ip so we can compare afterwards
};

exports.stop = () => {
  triggers.unwatch('network');
  if (osName === 'linux') {
    triggers.unwatch('wifi');
  }
  hooks.remove('connected', handleConnected);
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = [ 'ssid_changed', 'private_ip_changed', 'mac_address_changed', 'public_ip_changed'];

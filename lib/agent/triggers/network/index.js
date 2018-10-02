var triggers  = require('os-triggers'),
    join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks     = require(join(base_path, 'hooks')),
    providers = require(join(base_path, 'providers')),
    common    = require('./../../common'),
    logger    = common.logger.prefix('network'),
    toaster   = require('./../../utils/toaster'),
    Emitter   = require('events').EventEmitter;

var emitter,
    current  = {},
    checking = {};

var toast_opts = {
  title: 'Prey',
  message: 'Device Conectado/Desconectado'
}

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

exports.start = (opts, cb) => {

  triggers.watch('network')
    .then(network => {
      network.on('state_changed', (info) => {
        logger.info("NETWORK CHANGED!")
        toaster.notify(toast_opts);
        setTimeout(() => {
          // Trigger after a while....
          hooks.trigger('network_state_changed'); // for connection watcher

          check_if_changed('private_ip', 'private_ip_changed');
        }, 200); // wait a sec so IP gets assigned
      });

      hooks.on('connected', () => {
        check_if_changed('active_access_point_name', 'ssid_changed');
        check_if_changed('active_access_point_mac', 'mac_address_changed');
      });

      emitter = new Emitter();
      cb(null, emitter);
    
    })
    .catch(error => { return cb(error); })

  // get current SSID name and private ip so we can compare afterwards
  get_current(['active_access_point_name', 'private_ip', 'active_access_point_mac']);
};

exports.stop = () => {
  triggers.unwatch('network');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = [ 'ssid_changed', 'private_ip_changed', 'mac_address_changed' ];

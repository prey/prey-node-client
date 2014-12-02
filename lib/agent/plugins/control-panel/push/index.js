var server     = require('./server'),
    mapper     = require('./mapper'),
    entry      = require('entry'),
    scrambler  = require('scrambler'),
    parallel   = require('async').parallel,
    createHash = require('crypto').createHash,
    Emitter    = require('events').EventEmitter,
    api        = require('./../api'),
    bus        = require('../bus');

var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

// agent objects
var hooks,
    config,
    logger;

// the emitter object where the caller listens to
var emitter;

// strings, keys
var key_string,
    hash_key,
    secret;

// semaphores & timers
var stopped,
    is_mapping,
    ip_checker;

// ports & IPs
var mapped_port,
    public_ip,
    last_nid;

// mapping defaults
var service_desc = 'Prey Anti-Theft',
    port_start   = 30300;

// called on load and unload to assign common objects
var set = function(common) {
  hooks  = common.hooks;
  logger = common.logger;
  config = common.config;
}

var random_string = function(length){
  return Math.random().toString(36).substr(2, length);
}

var map_port = function(port, cb) {

  var opts = {
    starting : port,
    internal : port,
    name: service_desc
  }

  logger.info('Attempting to map external port ' + port);
  mapper.map(opts, cb);
};

var unmap_port = function(cb) {
  if (!mapped_port)
    return cb && cb(); // no need to return an error

  logger.warn('Unmapping port ' + mapped_port + ' in router.');

  mapper.unmap(function(e) {
    logger.info(e && e.message || 'Succesfully unmapped.');
    cb && cb(); // don't return error, otherwise parallel will stop waiting for the others.
  });

  mapped_port = null;
}

var send_notification_id = function(nid, cb) {

  var data = { notification_id: nid };
  logger.info('Updating notification ID...');

  api.push.data(data, {}, function(err, resp) {
    if (err || resp.statusCode > 300) {
      var reason  = err ? err.message : 'Got status ' + resp.statusCode,
          message = 'Failed to update notification ID: ' + reason;

      logger.error(message);
      return cb(new Error(message));
    }

    last_nid = nid;
    cb();
  });
}

var clear_notification_id = function(cb) {
  if (last_nid && last_nid != '')
    return send_notification_id('', cb);

  cb && cb();
}

var update_notification_id = function(cb) {

  mapper.public_ip(function(err, ip) {
    if (err) return cb(err);

    public_ip     = ip;
    secret        = random_string(12);
    var str       = ip + ':' + mapped_port + '-' + secret;
    var scrambled = scrambler.encrypt(str, hash_key.toString());
    send_notification_id(scrambled, cb);
  });

};

var notify_pushable = function(cb) {
  update_notification_id(function(err) {
    if (err) return stop(err, cb); // notify unreachable, turn off server

    bus.emit('reachable');
    logger.notice('Ready to receive push notifications.');
    cb && cb();
  });
}

var valid_secret = function(str) {
  if (!str || str == '')
    return;

  return str == secret;
  // return scrambler.decrypt(str, hash_key) == secret;
}

// called from load method once we have a mapped port
var mapped = function(port, cb) {

  mapped_port = port;
  logger.info('Port ' + port + ' mapped. Starting push handler.');

  server.listen(port, function(err, app) {
    if (err) return cb ? cb(err) : unload(err);

    app.on('request', function(headers, body) {
      if (!valid_secret(headers['x-secret']))
        return;

      logger.notice('Got valid push request!');

      if (body.command == 'run_once' || body.command == 'run')
        emitter.emit('woken');
      else
        emitter.emit('command', body);
    });

    // if notify fails, callback will not be called
    notify_pushable(function() {
      watch_public_ip();
      cb && cb();
    })

  });

};

var watch_public_ip = function() {

  ip_checker = setInterval(function() {
    mapper.public_ip(function(err, ip) {
      // console.log(err || ip);

      // if we couldnt get an IP (no UPNP)
      // or the IP changed, try to update our notification ID
      // if updating fails, we'll call stop() and trigger un 'unreachable' event
      if (err || ip != public_ip)
        notify_pushable();
    })
  }, 5 * 60 * 1000); // check if public ip changed every 5 minutes

}

var find_mapping = function(cb) {
  logger.notice('Checking for existing port mappings...');

  var found;
  entry.mine(function(err, list) {
    if (!list || !list[0]) {
      logger.info('No previously mapped ports found.')
      return cb(err);
    }

    list.forEach(function(mapping) {
      if (mapping.NewPortMappingDescription.match(service_desc))
        found = mapping;
    });

    cb(null, found);
  })
};

// this function is a mess. I know.
var check_mapping = function(cb) {
  stopped = false;

  if (mapped_port || is_mapping)
    return cb && cb();

  // if done is called with an error it means both detection and mapping failed.
  var done = function(err, port) {
    if (err) {
      logger.error('Unable to map port: ' + err.message);
      stop(err); // notify unreachable
      return cb && cb(err);
    } else if (port) {
      mapped(port, cb);
    }
  }

  is_mapping = true;
  find_mapping(function(err, mapping) {
    // if we couldnt find an existing mapped port,
    // we'll just keep on and map one.
    is_mapping = false;

    // if we were stopped while we were looking for port, stop here.
    // don't call done() or unmap(), as the mapper will complain
    // about no ports being mapped.
    if (stopped) return;

    if (mapping && mapping.NewExternalPort) {

      logger.notice('Found existing mapping! Using port ' + mapping.NewExternalPort);

      mapper.found_upnp_mapping({
        external: mapping.NewExternalPort,
        internal: mapping.NewExternalPort,
        name: service_desc
      });

      done(null, mapping.NewExternalPort);

    } else { // not mapped or mapped to someone else

      var starting_port = port_start + chars.split('').indexOf(key_string[0]);

      map_port(starting_port, function(err, resulting_port) {
        if (err) return done(err);

        // ok, in this case, if we were stopped in the process, we need to
        // ask the mapper to please revert the mapping it just did.
        if (stopped)
          return mapper.unmap();

        done(null, resulting_port);
      })
    }

  });
}

var unreachable = function() {
  bus.emit('unreachable');
}

var stop = function(err, cb) {
  stopped = true;
  unreachable();

  if (ip_checker) {
    clearTimeout(ip_checker);
  }

  if (!mapped_port)
    return cb && cb();

  logger.notice('Turning off push notifications.')

  parallel([
      server.stop,
      unmap_port,
      clear_notification_id
  ], function(e, res) {
    cb && cb(e);
  });
}

// called either by exports.unload() or if server.listen() fails
var unload = function(err, cb) {
  if (err)
    logger.error('Unloading due to error: ' + err.message);

  hooks.remove('connected', check_mapping);
  hooks.remove('disconnected', stop);

  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }

  stop(err, cb);
};

exports.load = function(cb) {
  set(this);

  key_string = config.get('device_key') || random_string(2);
  hash_key   = config.get('api_key');

  if (!hash_key)
    return cb(new Error('API key required for Push Notifications.'));

  hooks.on('connected', check_mapping);
  hooks.on('disconnected', stop);

  check_mapping();
  emitter = new Emitter();
  cb(null, emitter);
}

exports.unload = function(cb) {
  set(this);
  unload(null, cb);
}

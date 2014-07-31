var server     = require('./server'),
    mapper     = require('./mapper'),
    entry      = require('entry'),
    scrambler  = require('scrambler'),
    parallel   = require('async').parallel,
    createHash = require('crypto').createHash,
    Emitter    = require('events').EventEmitter,
    api        = require('./../api'),
    bus        = require('../bus');

var hooks,
    config,
    logger;

var secret,
    emitter,
    is_mapping,
    mapped_port,
    public_ip,
    last_nid,
    service_desc = 'Prey Anti-Theft',
    port_start   = 30300;

var ip_checker; // timer

var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

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

  logger.info('Unmapping port ' + mapped_port + ' in router.');

  mapper.unmap(function(e) {
    logger.info(e && e.message || 'Succesfully unmapped.');
    cb && cb(); // don't return error, otherwise parallel will stop waiting for the others.
  });

  mapped_port = null;
}

var send_notification_id = function(str, cb) {

  var data = { notification_id: str };
  logger.info('Updating notification ID...');

  api.push.data(data, {}, function(err, resp) {
    if (err || resp.statusCode > 300) {
      var msg = err ? err.message : ' Got status ' + resp.statusCode;
      return cb(new Error('Unable to update notification ID: ' + msg));
    }

    last_nid = str;
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
    var scrambled = scrambler.encrypt(str, config.get('api_key'));
    send_notification_id(scrambled, cb);
  });

};

var notify_pushable = function(cb) {
  update_notification_id(function(err) {
    if (err) return stop(err, cb); // notify unreachable, turn off server

    bus.emit('reachable');
    logger.info('Ready to receive push notifications.');
    cb && cb();
  });
}

var valid_secret = function(str) {
  if (!str || str == '')
    return;

  return str == secret;
  // return scrambler.decrypt(str, config.get('api_key')) == secret;
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

      logger.warn('Got valid push request!');

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
  logger.info('Checking for existing mappings...');

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

var check_mapping = function(cb) {
  if (mapped_port || is_mapping)
    return cb && cb();

  // if done_with_error is called, it means both detection and mapping failed.
  var done_with_error = function(err) {
    logger.error('Unable to map port: ' + err.message);

    stop(err); // notify unreachable
    return cb && cb(err);
  }

  is_mapping = true;
  find_mapping(function(err, mapping) {
    // if we couldnt find a mapped port, that's not a problem. 
    // we'll just continue and map one ourselves. 
    is_mapping = false;

    if (mapping && mapping.NewExternalPort) {

      logger.info('Found existing mapping! Using port ' + mapping.NewExternalPort);

      mapper.found_upnp_mapping({
        external: mapping.NewExternalPort,
        internal: mapping.NewExternalPort,
        name: service_desc
      });

      mapped(mapping.NewExternalPort, cb);

    } else { // not mapped or mapped to someone else

      var key  = config.get('device_key');
      
      if (!key)
        return cb && cb(new Error('Device key required!'))

      var starting_port = port_start + chars.split('').indexOf(key[0]);

      map_port(starting_port, function(err, resulting_port) {
        if (err) return done_with_error(err);

        mapped(resulting_port, cb);
      })

    }

  });
}

var unreachable = function() {
  bus.emit('unreachable');
}

var stop = function(err, cb) {
  unreachable();

  if (ip_checker) {
    clearTimeout(ip_checker);
  }

  logger.warn('Turning off push notifications.')

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
  hooks.on('connected', check_mapping);
  hooks.on('disconnected', stop);

  check_mapping(function(err) {
    if (err) return cb(err);

    emitter = new Emitter();
    cb(null, emitter);
  });
}

exports.unload = function(cb) {
  set(this);
  unload(null, cb);
}

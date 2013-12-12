var common       = require('./../../common'),
    hooks        = require('./../../hooks'),
    config       = common.config,
    logger       = common.logger.prefix('push'),
    push         = common.api.push,
    server       = require('./server'),
    entry        = require('entry'),
    scrambler    = require('./../../../utils/scrambler'),
    createHash   = require('crypto').createHash,
    Emitter      = require('events').EventEmitter;

var secret,
    emitter,
    mapped_port,
    public_ip,
    last_nid,
    upnp_desc    = 'Prey Anti-Theft',
    port_start   = 30300,
    max_attempts = 30;

var ip_checker; // timer

var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

var random_string = function(length){
  return Math.random().toString(36).substr(2, length);
}

var map_port = function(port, attempt, cb){
  var opts = {
    external: port,
    internal: port,
    name: upnp_desc
  }

  logger.info('Attempting to map external port ' + port);
  entry.map(opts, function(err, resp){
    if (!err) return cb(null, port);

    if (attempt < max_attempts && err.message.match('Already mapped'))
      map_port(port + 1, attempt + 1, cb); // try one above
    else
      cb(err);
  })
};

var send_notification_id = function(str, cb) {

  var data = { notification_id: str };
  logger.info('Updating notification ID...');

  push.data(data, {}, function(err, resp, body){
    var success = resp && resp.statusCode < 300;
    if (success) last_nid = str;
    cb && cb(success ? null : new Error('Unable to send notification ID.'));
  });

}

var update_notification_id = function(cb){

  entry.public_ip(function(err, ip){
    if (err) return cb(err);

    public_ip     = ip;
    secret        = random_string(12);
    var str       = ip + ':' + mapped_port + '-' + secret;
    var scrambled = scrambler.encrypt(str, config.get('api_key'));
    send_notification_id(scrambled, cb);
  });

};

var notify_pushable = function(cb) {
  update_notification_id(function(err){
    if (err) return unload(err, cb);

    hooks.trigger('reachable');
    logger.info('Ready to receive push notifications.');
    cb && cb();
  });
}

var find_mapping = function(cb){

  var found;

  logger.info('Checking for existing mappings...');
  entry.mine(function(err, list){
    if (err) return cb(err);

    list.forEach(function(mapping){
      if (mapping.NewPortMappingDescription.match(upnp_desc))
        found = mapping;
    });

    cb(null, found);
  })

};

var valid_secret = function(str) {
  if (!str || str == '')
    return;

  return str == secret;
  // return scrambler.decrypt(str, config.get('api_key')) == secret;
}

var stop = function(){
  logger.warn('Turning off push notifications.')

  if (server)
    server.stop();

  if (ip_checker)
    clearTimeout(ip_checker);

  hooks.trigger('unreachable');

  if (!mapped_port)
    return;

  logger.info('Unmapping port ' + mapped_port + ' in router.');

  entry.unmap({ external: mapped_port }, function(err) {
    logger.info(err && err.message || 'Succesfully unmapped.');
  });

  mapped_port = null;
}

var unload = function(err){
  if (err)
    logger.error('Unloading due to error: ' + err.message);

  // reset notification id, if we were able to send it
  if (last_nid && last_nid != '')
    send_notification_id('');

  stop();
  emitter.emit('unload', err);
};

// called from load method once we have a mapped port
var mapped = function(err, port, cb){
  if (err) return cb && cb(err);

  mapped_port = port;
  logger.info('Port ' + port + ' mapped. Starting push handler.');

  server.listen(port, function(err, app) {
    if (err) return cb ? cb(err) : unload(err);

    app.on('request', function(headers, body) {
      if (!valid_secret(headers['x-secret']))
        return;

      logger.warn('Got valid push request!');

      if (body.command == 'run_once')
        hooks.trigger('woken');
      else
        emitter.emit('command', body);
    });

    notify_pushable(function(err) {
      watch_public_ip();
      cb && cb();
    })

  });

};

var watch_public_ip = function() {

  ip_checker = setInterval(function() {
    entry.public_ip(function(err, ip) {
      console.log(err || ip);

      if (err || ip != public_ip)
        notify_pushable();
    })
  }, 5 * 60 * 1000); // check if public ip changed every 5 minutes

}

var check_mapping = function(cb) {
  if (mapped_port)
    return cb && cb();

  find_mapping(function(err, mapping){
    if (err) return cb ? cb(err) : unload(err);

    if (mapping) {
      logger.info('Found existing mapping! Using port ' + mapping.NewExternalPort);
      mapped(null, mapping.NewExternalPort, cb);

    } else { // not mapped or mapped to someone else
      var key  = config.get('device_key');
      var port = port_start + chars.split('').indexOf(key[0]);

      map_port(port, 1, function(err, port){
        if (err) return cb && cb(err);
        mapped(null, port, cb);
      })
    }

  });

}

exports.load = function(opts, cb){
  hooks.on('connected', check_mapping);
  hooks.on('disconnected', stop);

  emitter = new Emitter();
  cb(null, emitter);
}

exports.unload = function(cb){
  unload();
  cb && cb();
}

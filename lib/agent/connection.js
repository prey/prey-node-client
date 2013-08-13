var resolve  = require('dns').resolve,
    hooks    = require('./hooks'),
    common   = require('./common'),
    logger   = common.logger.prefix('connection'),
    system   = common.system;

var status, // either connected or disconnected
    target   = 'www.google.com',
    checking = false,
    reconnect_timeout = 15000;

var is_connected = function(cb) {
  resolve(target, function(err){
    var result = err ? 'disconnected' : 'connected';
    cb(result);
  });
}

var check_status = function() {
  if (checking) return;

  checking = true;
  is_connected(function(new_status){
    logger.info('Checked status. Result: ' + new_status)

    if (status != new_status)
      hooks.trigger(new_status);

    if (new_status == 'disconnected')
      exports.down();

    status = new_status;
    checking = false;
  });
}

var reconnect = function(cb) {
  system.reconnect(function(err, out){
    if (err) return cb && cb(false);
    // no need to check status, we can just wait for the
    // 'network_status_changed' event to be triggered
    // setTimeout(check_status, reconnect_timeout);
  });
}

exports.down = function(err) {
  if (!common.config.get('auto_connect'))
    return;

  logger.notice('Not connected. Trying to connect...');
  reconnect();
}

exports.watch = function() {
  check_status();
  hooks.on('network_state_changed', check_status);
  // setInterval(check_status, 5000); // for debugging connection checks
}

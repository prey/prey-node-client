var resolve  = require('dns').resolve,
    hooks    = require('./hooks'),
    common   = require('./common'),
    logger   = common.logger.prefix('connection');

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

    status = new_status;
    checking = false;
  });
}

exports.watch = function() {
  check_status();
  hooks.on('network_state_changed', check_status);
  // setInterval(check_status, 5000); // for debugging connection checks
}

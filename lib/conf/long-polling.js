var needle  = require('needle'),
    util    = require('util'),
    account = require('./account'),
    common  = require('./../agent/common'),
    secure  = require('./../agent/plugins/control-panel/secure'),
    logger  = common.logger.prefix('new-config');

var current_request,
    loaded,
    instant_responses = 0,
    schedule = true,
    encoded_public_key;

var request = function() {
  var status_code,
      request_start,
      response_delay,
      resp_timeout;

  var protocol = 'https',
      host = 'solid.preyproject.com',
      base = protocol + '://' + host,
      url  = base + '/api/v2/devices/sso_config/' + encoded_public_key;

  var options = {
    timeout: 1000 * 60,
    user_agent: common.system.user_agent
  };
  
  logger.debug('Fetching config...');
  request_start = new Date()
  current_request = needle.get(url, options);
  attach_listeners(current_request);

  function attach_listeners(request) {
    request.on('data', function(data) {
      logger.info("Data received!");

      try {
        Buffer.isBuffer(data) ? data = { api_key: data.toString().split('[')[1].split(']')[0] } : data;
      } catch(e) {
        return secure.notify_error();
      }
      
      if (data.api_key) {
        secure.decrypt_and_notify(data.api_key, function(err) {
          if (!err) unload();
        }) 
      }
    });

    request.on('end', function() {
      var msg = options.proxy ? 'with proxy' : '';
      logger.debug('Request ' + msg + ' ended');
    });

    request.request.on('response', function(res) {
      status_code = res.statusCode;

      if (status_code !== 200) {
        propagate_error('Invalid response received with status code ' + res.statusCode);
        resp_timeout = 30000;

        if (status_code == 406) resp_timeout = 60000;
        clear_current_request();

      } else {
        resp_timeout = 5000;
      }

      response_delay = (new Date() - request_start) / 1000;

      if (response_delay < 1) {
        instant_responses++
      } else {
        instant_responses = 0;
      }

      if (instant_responses > 5) {
        logger.debug('It seems the server is not using long-polling. Adding delay.');
        return setTimeout(check_for_reschedule, resp_timeout);
      }
    });

    // This is most likely a connection error.
    // If try_proxy is set, let's retry with no proxy.
    request.request.on('error', function(err) {
      clear_current_request();
      if (options.proxy) {
        logger.debug('Trying to reconnect without proxy');
        delete options.proxy;
        current_request = needle.get(url, options);
        attach_listeners(current_request);
      } else {
        setTimeout(check_for_reschedule, 3000);
      }
    });

    request.request.on('abort', function() {
      logger.debug("Request aborted");
    });

    request.on('error', function(err) {
      propagate_error(err);
    });

  }

  function propagate_error(message) {
    logger.info(message);
  }

  function check_for_reschedule() {
    current_request = null;
    if (schedule) {
      logger.debug("Re-scheduling request");
      request();
    }
  }
};

function clear_current_request() {
  if (current_request) {
    logger.debug("Clearing current request");
  if (current_request.request) {
    logger.debug("Aborting current request");
    current_request.request.abort();
  }
  current_request = null;
  }
}

var unload = function() {
  schedule = false;
  loaded = false;

  if (current_request) {
    clear_current_request();
  }
};

exports.load = function(cb) {
  encoded_public_key = secure.public_keys().b64_formatted;
  loaded = true;

  if (!common.helpers.running_on_background()) 
    return cb();
  
  request();

  return cb();
};

exports.unload = function() {
  if (!loaded) return;
  unload();
};

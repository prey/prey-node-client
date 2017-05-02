var needle = require('needle'),
    util = require('util'),
    keys = require('../api/keys'),
    errors = require('../api/errors'),
    logger  = require('../../../common').logger.prefix('long-polling'),
    https = require('https'),
    Emitter = require('events').EventEmitter;

var hooks,
    config,
    user_agent;

var emitter,
    connection_status,
    connected,
    current_request,
    loaded,
    instant_responses = 0;

var request = function(re_schedule) {
  if (!connected || current_request) {
    var err = current_request ? 'Already running request' : 'Cannot fetch instructions: Device Disconnected';
    logger.debug(err);
    return;
  }

  https.globalAgent.options.secureProtocol = 'TLSv1_method';

  var proxy = config.get('try_proxy'),
      protocol = config.get('protocol'),
      host = config.get('host'),
      device_key = keys.get().device,
      api_key = keys.get().api;

  // used for benchmarking and request interval setup
  var status_code,
      request_start,
      response_delay,
      resp_timeout;

  if (!keys.get().device) return propagate_error(errors.get('NO_DEVICE_KEY'));

  var base  = protocol + '://' + host,
      url   = base + '/api/v2/devices/' + device_key + '.json';

  var options = {
    protocol: protocol,
    host: host,
    username: api_key,
    password: 'x',
    timeout: 1000 * 120,
    user_agent: user_agent
  };

  if (proxy) {
    options.proxy = proxy;
    logger.debug('Setting up proxy');
  }

  logger.debug('Fetching instructions...');
  request_start = new Date()
  current_request = needle.get(url, options);
  attach_listeners(current_request);

  function attach_listeners(request) {

    request.on('data', function(data) {
      if (util.isBuffer(data)) {
        if (data.toString() == "\n") return;
        data = JSON.parse("{" + data.toString() + "}")["instruction"] || data
      }
      var len = data.length;

      if (len && len > 0) {
        logger.info('Got ' + len + ' commands.');
        process_commands(data);
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
      check_for_reschedule();
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

  function process_commands(arr) {
    if (arr.forEach) {
      arr.forEach(function(el) {
        var cmd = el.target ? el : parse_cmd(el);
        if (cmd) emitter.emit('command', cmd);
      });
    } else {
      propagate_error('Invalid command object');
    }
  }

  function parse_cmd(str) {
    try {
      return JSON.parse(str);
    } catch(e) {
      if (hooks)
        propagate_error('Invalid command: ' + str);
    }
  }

  function propagate_error(message) {
    hooks.trigger('error', new Error(message));
    logger.debug(message);
  }

  function check_for_reschedule() {
    current_request = null;
    if (re_schedule) {
      logger.debug("Re-scheduling request");
      request(true);
    }
  }

  function stop_schedule() {
    re_schedule = false;
    clear_current_request()
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

function load_hooks() {
  hooks.on('connected', function() {
    connected = true;
    request(true);
  });

  hooks.on('disconnected', function() {
    if (current_request) {
      logger.debug("Aborting current request");
      current_request.request.abort();
    }
    connected = false;
  });

  loaded = true;
}

var unload = function() {
  hooks.remove('connected', request);
  hooks.remove('disconnected', request);

  if (current_request) {
    clear_current_request();
  }

  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }

  loaded = false;
};

exports.check = function() {
  request();
};

exports.load = function(cb) {
  if (emitter)
    return cb(null, emitter);

  var common = this;
  user_agent = common.system.user_agent;
  config = common.config;
  hooks = common.hooks;

  // Hooks take care of beginning the request iteration
  // when connected and stopping it when disconnected
  load_hooks();

  emitter = new Emitter();
  cb(null, emitter);
};

exports.unload = function(cb) {
  if (!hooks) return; // not loaded yet.
  unload();
  cb && cb(true);
};

var needle        = require('needle'),
    https         = require('https'),
    util          = require('util'),
    keys          = require('../api/keys'),
    errors        = require('../api/errors'),
    logger        = require('../../../common').logger.prefix('long-polling'),
    fileretrieval = require('./../../../actions/fileretrieval'),
    triggers      = require('./../../../actions/triggers'),
    lp_conf       = require('./../../../../conf/long-polling'),
    status_trigger = require('./../../../triggers/status'),
    updater       = require('./../../../updater'),
    server        = require('./server'),
    Emitter       = require('events').EventEmitter;

var hooks,
    config,
    user_agent;

var emitter,
    connection_status,
    connected,
    current_request,
    loaded,
    instant_responses = 0,
    re_schedule = true,
    last_time = null;

var update_timestamp = () => {
  last_time = Date.now();
}

var request = function() {
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
    timeout: 1000 * 60 * 5,
    user_agent: user_agent
  };

  status_trigger.get_status((err, status) => {
    if (!err)
      options.headers = { 'X-Prey-Status': JSON.stringify(status) }

    if (proxy) {
      options.proxy = proxy;
      logger.debug('Setting up proxy');
    }

    logger.debug('Fetching instructions...');
    request_start = new Date()
    current_request = needle.get(url, options);
    attach_listeners(current_request);
  })

  function attach_listeners(request) {

    request.on('data', function(data) {
      if (util.isBuffer(data)) {
        if (data.toString() == "\n") return;

        try {
          data = JSON.parse("{" + data.toString() + "}")["instruction"]
        } catch (e) {
          try {
            data = JSON.parse(data)
          } catch (e2) {
            return propagate_error('Invalid command object');
          }
        }
      }
      var len = data.length;

      if (len && len > 0) {
        logger.info('Got ' + len + ' commands.');
        process_commands(data);
      } else {
        if (config.get('auto_update')) updater.check_for_update();
      }
    });

    request.on('end', function() {
      var msg = options.proxy ? 'with proxy' : '';
      logger.debug('Request ' + msg + ' ended');
    });

    request.request.on('response', function(res) {
      update_timestamp();
      status_code = res.statusCode;
      if (status_code !== 200) {
        propagate_error('Invalid response received with status code ' + res.statusCode);
        if (config.get('auto_update')) updater.check_for_update();
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
      request();
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
    fileretrieval.check_pending_files();
    triggers.start();
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

  re_schedule = true;
  loaded = true;
}

var unload = function() {
  hooks.remove('connected', request);
  hooks.remove('disconnected', request);

  server.close();
  if (current_request) {
    clear_current_request();
  }

  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
  re_schedule = false;
  loaded = false;
};

exports.check = function() {
  request();
};

exports.load = function(cb) {
  lp_conf.unload();

  server.create_server();
  update_timestamp();

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

exports.current = function(cb) {
  return cb(current_request);
}

exports.check_timestamp = () => {
  if (!last_time || (Date.now() - last_time > 1000 * 60 * 5))
    return false;
  return true;
}
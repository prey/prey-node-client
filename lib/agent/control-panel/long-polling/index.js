var needle        = require('needle'),
    https         = require('https'),
    util          = require('util'),
    keys          = require('../api/keys'),
    errors        = require('../api/errors'),
    common        = require('../../common'),
    logger        = common.logger.prefix('long-polling'),
    fileretrieval = require('../../actions/fileretrieval'),
    triggers      = require('../../actions/triggers'),
    lp_conf       = require('../../../conf/long-polling'),
    status_trigger = require('../../triggers/status'),
    storage       = require('../../utils/storage'),
    updater       = require('../../updater'),
    server        = require('./server'),
    Emitter       = require('events').EventEmitter;

var hooks,
    config,
    user_agent;

var emitter,
    getting_status = false,
    current_request,
    loaded,
    instant_responses = 0,
    re_schedule = true;

var last_time = null,
    last_unseen,
    last_connection,
    last_stored;

exports.startup_timeout = 5000;

var update_timestamp = () => {
  last_time = Date.now();
}

var request = function() {
  if (current_request) {
    logger.debug('Already running request');
    return;
  }

  https.globalAgent.options.secureProtocol = 'TLSv1_2_method';

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
    timeout: 1000 * 65,
    user_agent: user_agent
  };

  if (getting_status) return;
  getting_status = true;

  status_trigger.get_status((err, status) => {
    getting_status = false;
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
      if (Buffer.isBuffer(data)) { //
        if (data.toString() == "\n" || data.toString() == "") return;
        try {
          data = JSON.parse("{" + data.toString() + "}")["instruction"]
        } catch (e) {
          try {
            data = JSON.parse(data)
          } catch (e2) {
            return propagate_error('Invalid command object');
          }
        }
      } else if (data.timeout) {
        resp_timeout = data.timeout * 60 * 1000;
      }
      var len = data.length;

      if (len && len > 0) {
        logger.info('Got ' + len + ' commands.');
        process_commands(data);
      } else {
        if (common.config.get('auto_update') && process.argv.indexOf('spec') == -1)
          updater.check_for_update();
      }
    });

    request.on('end', function() {
      var msg = options.proxy ? 'with proxy' : '';
      logger.debug('Request ' + msg + ' ended');
    });

    request.request.on('response', function(res) {
      update_timestamp();
      status_code = res.statusCode;

      if (status_code == 200) {
        var new_stored_time = Math.round(Date.now()/1000);
        last_connection = new_stored_time;
        update_stored_connection(new_stored_time)
      }

      var reschedule = () => {
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
      }

      if (status_code !== 200) {
        propagate_error('Invalid response received with status code ' + res.statusCode);
        if (common.config.get('auto_update') && process.argv.indexOf('spec') == -1)
          updater.check_for_update();

        resp_timeout = 30000;

        if (status_code == 406) resp_timeout = 5 * 60 * 1000;  // 5 minutes by default

        setTimeout(() => {
          clear_current_request();
          reschedule();
        }, 200)

      } else {
        resp_timeout = 5000;
        reschedule();
      }
    });

    // This is most likely a connection error.
    // If try_proxy is set, let's retry with no proxy.
    request.request.on('error', function(err) {
      logger.info('Unable to connect to prey host: ' +  err);
      if (!last_unseen || last_unseen + 60000 < Date.now()) {   // Only one event per minute tops
        last_unseen = Date.now();
        hooks.trigger('device_unseen');
      }

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

function update_stored_connection (new_stored_time) {
  storage.do('update', { type: 'keys', id: 'last_connection', columns: 'value', values: new_stored_time }, (err) => {
    if (err) logger.info("Unable to update the local last connection value")
  })
}

function load_hooks() {
  storage.do('query', {type: 'keys', column: 'id', data: 'last_connection'}, (err, stored) => {
    if (err) logger.info("Error getting the last connection data");
    if (stored && stored.length > 0) {
      last_stored = stored[0]
      last_connection = last_stored;

    } else {
      // Just the first time the client starts
      last_connection = Math.round(Date.now()/1000);
      storage.do('set', {type: 'keys', id: 'last_connection', data: {value: last_connection}}, (err) => {
        if (err) logger.info("Error storing the last connection time")
        logger.debug("Stored referential first connection time");
      });
    }
  });

  hooks.on('connected', function() {
    fileretrieval.check_pending_files();
    triggers.start();
  });

  re_schedule = true;
  loaded = true;
  
  setTimeout(() => {
    request();
    server.create_server((err) => {
      if (err) logger.debug(err.message)
      update_timestamp();
    });
  }, exports.startup_timeout);
}

var unload = function() {
  hooks.remove('connected');

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

exports.load = function(cb) {
  lp_conf.unload();

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

exports.last_connection = function() {
  return last_connection;
};

exports.check_timestamp = () => {
  if (!last_time || (Date.now() - last_time > 1000 * 60 * 5))
    return false;
  return true;
}
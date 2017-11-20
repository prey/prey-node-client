var needle        = require('needle'),
    logger        = require('./../agent/common').logger.prefix('long-polling'),
    account       = require('./account'),
    Emitter       = require('events').EventEmitter;

var JSEncrypt   = require('node-jsencrypt'),
    device_keys = require('./../agent/utils/keys-storage'),
    keys        = require('./../agent/plugins/control-panel/api/keys');

var crypt = new JSEncrypt();
var private_key,
    public_key;

var common,
    hooks,
    config,
    user_agent;

var emitter,
    connection_status,
    connected,
    current_request,
    loaded,
    instant_responses = 0;

var schedule = true;

var request = function(re_schedule) {

  var protocol = 'https',
      host = 'panel.preyhq.com';

  // var protocol = 'http',
  //     host     = '10.10.2.98:3000';

  // used for benchmarking and request interval setup
  var status_code,
      request_start,
      response_delay,
      resp_timeout;

  var base  = protocol + '://' + host,
      url   = base + '/api/v2/devices/client_configuration';

  var options = {
    protocol: protocol,
    host: host,
    timeout: 1000 * 120
  };

  var publicKey = public_key.split('BEGIN PUBLIC KEY-----\n').pop().split('\n-----END').shift();
  var encoded_public_key = new Buffer(JSON.stringify(publicKey, null, 0)).toString('base64');

  var data = {
    "opt": "get",
    "token": encoded_public_key
  }
  
  logger.debug('Fetching CONFIG...');
  request_start = new Date()
  current_request = needle.post(url, data);
  attach_listeners(current_request);

  function attach_listeners(request) {
    request.on('data', function(data) {
      console.log("DATA!!", data.toString())
      crypt.setPublicKey(public_key);
      crypt.setPrivateKey(private_key);

      if (data.api_key) {
        try {
          var api_uncrypted = crypt.decrypt(data.api_key);
        } catch(e) {
          console.log("EXCEPTION!!:", e)
          var data = {
            "message": {
              "status": "error"
            }
          }
          unload();
          return needle.post(url, data);
        }

        var apikey = {
              '-a' : api_uncrypted.toString()
            };

        console.log("UNCRYPTED!!:", api_uncrypted);

        account.authorize(apikey, function(err, out) {
          // console.log("CONFIG:", config, config.device_key)
          var data = {
            "message":{
              "status": "ok",
              "api_key": api_uncrypted.toString(),
              "device_key": keys.get().device,
              "device_info":{
                "name": "Macbook air 13"
              }
            }
          }
          needle.post(url, data);
          unload();

        }); 
      }
    });

    request.on('end', function() {
      var msg = options.proxy ? 'with proxy' : '';
      logger.debug('Request ' + msg + ' ended');
    });

    request.request.on('response', function(res) {
      status_code = res.statusCode;

      console.log("RES!!!!:", res.statusCode)

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

  function propagate_error(message) {
    logger.info(message);
  }

  function check_for_reschedule() {
    current_request = null;
    if (re_schedule) {
      logger.debug("Re-scheduling request");
      request(schedule);
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
  // request();

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
  // user_agent = common.system.user_agent;
  config = common.config;

  device_keys.exist(['private', 'public'], function(err, exists, value) {

    private_key = value[0];
    public_key = value[1];

    loaded = true;
    request(true);

    emitter = new Emitter();
    cb(null, emitter);
  });
};

exports.unload = function(cb) {
    unload();
    cb && cb(true);
};

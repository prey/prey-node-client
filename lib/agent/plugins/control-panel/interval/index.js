var api     = require('./../api'),
    getter  = api.devices.get,
    Emitter = require('events').EventEmitter;

var hooks,
    logger,
    loaded;

var emitter,
    connection_status,
    connected,
    current_request;

var request = function(re_schedule) {
  if (!connected || current_request) {
    var err = current_request ? 'Already running request' : 'Cannot fetch instructions: Device Disconnected';
    logger.debug(err);
    return;
  }

  logger.debug('Fetching instructions...');

  current_request = getter.commands();

  current_request.on('data', function(resp) {
    var len = resp.length;

    if (len && len > 0) {
      logger.info('Got ' + len + ' commands.');
      process_commands(resp);
    }
  });

  current_request.on('end', function() {
    logger.debug("Request ended");
    current_request = null;
    if (re_schedule) {
      request(true);
    }
  });

  current_request.on('error', function(err) {
    console.log(err);
  });

  function process_commands(arr) {
    arr.forEach(function(el) {
      var cmd = el.target ? el : parse_cmd(el);
      if (cmd) emitter.emit('command', cmd);
    });
  }

  function parse_cmd(str) {
    try {
      return JSON.parse(str);
    } catch(e) {
      if (hooks)
        hooks.trigger('error', new Error('Invalid command: ' + str));
    }
  }

//  current_request.on('response', function(inc) {
//    console.log(inc);
//  });

  //getter.commands(function(err, resp) {
  //  console.log("asdf");
  //  requesting = false;

  //  // need to re-check if connected in case the disconnection happened while
  //  // the request was running
  //  if(re_schedule && connected) {
  //    logger.debug('Re-scheduling request.');
  //    request(true);
  //  }

  //  if (err)
  //    return hooks.trigger('error', err, 'interval');
  //  else if (resp.statusCode != 200)
  //    return hooks.trigger('error', new Error('Invalid response received: ' + resp.statusCode));
  //  else if (!resp.body.forEach)
  //    return hooks.trigger('error', new Error('Invalid commands object: ' + resp.body.toString()));

  //  if (resp.body.length && resp.body.length > 0)
  //    logger.warn('Got ' + resp.body.length + ' commands.');

  //  resp.body.forEach(function(el) {
  //    var cmd = el.target ? el : parse_cmd(el);
  //    if (cmd) emitter.emit('command', cmd);
  //  });

  //});
};

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
    logger.debug("Aborting current request");
    current_request.request.abort();
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
  hooks = common.hooks;
  logger = common.logger;

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

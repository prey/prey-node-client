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

  current_request.on('data', function(data) {
    var len = data.length;

    if (len && len > 0) {
      logger.info('Got ' + len + ' commands.');
      process_commands(data);
    }
  });

	current_request.request.on('response', function(resp) {
		if (resp.statusCode !== 200)
			propagateError('Invalid response received with status code ' + resp.statusCode);
	});

  current_request.on('end', function() {
    logger.debug("Request ended");
		checkForReschedule();
  });

  current_request.on('error', function(err) {
		propagateError(err);
		checkForReschedule();
  });

  function process_commands(arr) {
		if (arr.forEach) {
			arr.forEach(function(el) {
				var cmd = el.target ? el : parse_cmd(el);
				if (cmd) emitter.emit('command', cmd);
			});
		} else {
			handleError('Invalid command object');
		}
  }

  function parse_cmd(str) {
    try {
      return JSON.parse(str);
    } catch(e) {
      if (hooks)
				propagateError('Invalid command: ' + str);
    }
  }

	function propagateError(message) {
		hooks.trigger('error', new Error(message));
	}

	function checkForReschedule() {
    current_request = null;
		if (re_schedule) {
			request(true);
		}
	}
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

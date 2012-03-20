// set paths
var path = require('path');
exports.root_path = process.env.ROOT_PATH || path.resolve(path.join(__dirname, '..', '..'));
exports.script_path = path.join(exports.root_path, 'bin', 'prey.js');

// os specific
exports.os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
exports.os = require('./platform/' + exports.os_name);

// logger, version, command line args
exports.version = require(exports.root_path + '/package').version,
exports.program = require('commander');

// if run either through cron or trigger, log to os.log_file_path
var log_stream = (!process.env.TERM || process.env.TRIGGER)
	? require('fs').createWriteStream(exports.os.log_file_path) : null;

exports.logger = require('./logger').init((exports.program.debug ? 'debug' : 'info'), {stream: log_stream});

// helpers, user agent
exports.helpers = require('./helpers');
exports.user_agent = "Prey/" + exports.version + " (NodeJS, "  + exports.os_name + ")";

exports.load_config = function(){

	exports.config_path = exports.program.path || exports.os.default_config_path;
	exports.config_file = exports.config_path + '/config.js';

	try {
		exports.config = require(exports.config_file);
		exports.private_key_path = exports.config_path + '/' + exports.config.private_key_file;
		exports.certificate_path = exports.config_path + '/' + exports.config.certificate_file;
	} catch(e) {
		console.error("Config file not found: " + exports.config_file);
	}

	return this;

}

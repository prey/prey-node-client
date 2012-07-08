// set paths
var path = require('path');
exports.root_path = process.env.ROOT_PATH || path.resolve(path.join(__dirname, '..', '..'));
exports.script_path = path.join(exports.root_path, 'bin', 'prey.js');

// logger, version, command line args
exports.version = require(exports.root_path + '/package').version,
exports.program = require('commander');

// if run either through cron or trigger, log to os.log_file_path
var log_stream = (!process.env.TERM || process.env.TRIGGER)
	? require('fs').createWriteStream(exports.os.log_file_path) : null;

exports.logger = require('./logger').init((exports.program.debug ? 'debug' : 'info'), {stream: log_stream});

// os specific
exports.os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
exports.os = require('./platform/' + exports.os_name);

// helpers, user agent
exports.helpers = require('./helpers');
exports.user_agent = "Prey/" + exports.version + " (Node.js, "  + exports.os_name + ")";

var config_path = exports.program.path || exports.os.default_config_path;
exports.config = require('./config').load(path.join(config_path, 'config.json'));

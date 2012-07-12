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
exports.os = require('./os/' + exports.os_name);

// helpers, user agent
exports.helpers = require('./helpers');
exports.user_agent = "Prey/" + exports.version + " (Node.js, "  + exports.os_name + ")";

exports.config_path = exports.program.path || exports.os.default_config_path;
exports.config_file = path.join(exports.config_path, 'prey.conf');
exports.config = require('getset').load(exports.config_file);

exports.private_key_path = path.join(exports.config_path, exports.config.get('private_key'));
exports.certificate_path = path.join(exports.config_path, exports.config.get('certificate'));

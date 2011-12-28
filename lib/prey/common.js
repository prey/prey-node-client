// set paths

var path = require('path');
exports.root_path = process.env.ROOT_PATH || path.resolve(path.join(__dirname, '..', '..'));
exports.script_path = exports.root_path + '/prey.js';

// logger, version, command line args

// exports.config = require(root_path + '/config');
exports.logger = require('./logger').init((process.env.DEBUG ? 'debug' : 'info'));
exports.version = require(exports.root_path + '/package').version,
exports.program = require('commander');
exports.constants = require('./constants');

// base modules

exports.helpers = require('./helpers');
exports.os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
exports.os = require('./platform/' + exports.os_name);
exports.user_agent = "Prey/" + exports.version + " (NodeJS, "  + exports.os_name + ")";

exports.load_config = function(){

	exports.config_path = exports.program.path || exports.os.default_config_path;
	exports.config_file = exports.config_path + '/config.js';

	try {
		exports.config = require(exports.config_file);
		exports.private_key_path = exports.config_path + '/' + exports.config.private_key_file;
		exports.certificate_path = exports.config_path + '/' + exports.config.certificate_file;
		if(exports.config.device_key) exports.set_device_constants();
	} catch(e) {
		console.log("Config file not found: " + exports.config_file);
	}
	
	return this;

}

exports.set_device_constants = function(){
	exports.device = exports.constants.device(exports.config.device_key);
}
// set paths

var path = require('path');
exports.root_path = process.env.ROOT_PATH || path.resolve(path.join(__dirname, '..', '..'));
exports.script_path = exports.root_path + '/prey.js';

// load base modules

// exports.config = require(root_path + '/config');
exports.logger = require('./logger').init((process.env.DEBUG ? 'debug' : 'info'));
exports.version = require(exports.root_path + '/package').version,
exports.program = require('commander');
exports.constants = require('./constants');

// load base modules

exports.helpers = require('./helpers');
exports.os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
exports.os = require('./platform/' + exports.os_name);
exports.user_agent = "Prey/" + exports.version + " (NodeJS, "  + exports.os_name + ")";

exports.set_config = function(config){
	exports.config = config;
	if(config.device_key) exports.set_device_constants();

	if(!exports.config_path) return;
	exports.private_key_path = exports.config_path + '/' + config.private_key_file;
	exports.certificate_path = exports.config_path + '/' + config.certificate_file;

}

exports.set_device_constants = function(){
	exports.device = exports.constants.device(exports.config.device_key);
}
// set paths

var path = require('path');
exports.root_path = process.env.ROOT_PATH || path.resolve(path.join(__dirname, '..', '..'));

// load base modules

exports.config = require('./../../config');
exports.logger = require('./logger').init('debug');
exports.version = require(exports.root_path + '/package').version,
exports.program = require('commander');

// load base modules

exports.helpers = require('./helpers');
exports.os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
exports.os = require('./platform/' + exports.os_name);
exports.user_agent = "Prey/" + exports.version + " (NodeJS, "  + exports.os_name + ")";

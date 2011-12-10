var path = require('path');

var root_path = process.env.ROOT_PATH || path.resolve(path.join(__dirname, '..', '..'));
var os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

exports.config = require('./../../config');
exports.version = require(root_path + '/package').version,
// exports.logger = require('nlogger').logger(module.parent || 'base');
exports.logger = require('./logger').init('debug');
exports.helpers = require('./helpers');
exports.root_path = root_path;
exports.modules_path = path.join(root_path, 'prey_modules');
exports.os_name = os_name;
exports.os = require('./platform/' + os_name);
exports.user_agent = "Prey/" + exports.version + " (NodeJS, "  + exports.os_name + ")";

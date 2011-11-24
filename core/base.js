var path = require('path');

var root_path = path.resolve(path.join(__dirname, '..'));
var script_path = path.join(root_path, 'prey.js');
var os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

exports.logger = require('../lib/logger');
exports.helpers = require('./helpers');
exports.root_path = root_path;
exports.modules_path = path.join(root_path, 'prey_modules');
exports.os_name = os_name;
exports.os = require(root_path + '/platform/' + os_name);

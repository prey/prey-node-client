var common = exports.common = require('./prey/common');
var agent  = exports.agent  = require('./prey/agent');

if(!common.config) common.load_config();
var config = exports.config = exports.common.config;

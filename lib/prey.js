var common = exports.common = require('./prey/common');

if(!common.config) common.load_config();
// var config = exports.config = exports.common.config;

var agent  = exports.agent  = require('./prey/agent');
var hooks  = exports.hooks  = require('./prey/hooks');
var dispatcher = exports.dispatcher  = require('./prey/dispatcher');
var provider = exports.provider = require('./prey/provider_hub');



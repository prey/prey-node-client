var common = module.exports;

var join = require('path').join,
    root_path   = process.env.ROOT_PATH || join(__dirname, '..');

// logger, version, command line args
var version = require(join(root_path, 'package')).version;
var program = require('commander');

var system  = require(join(root_path, 'lib', 'system'));
var os_name = system.os_name;

var default_config_file = join(root_path, 'prey.conf.default');
var config_path = program.path || system.paths.config;

var config_file = join(config_path, 'prey.conf');
var config      = require('getset').loadSync(config_file);

// exports
common.root_path    = root_path;
common.script_path  = script_path;
common.version      = version;
common.program      = program;
common.os_name      = os_name;
common.system       = system;
common.config       = config;
common.config_path  = config_path;
common.default_config_file = default_config_file;

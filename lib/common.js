var common = module.exports;

var join = require('path').join,
    root_path = process.env.ROOT_PATH || join(__dirname, '..'),
    version = require(join(root_path, 'package')).version,
    program = require('commander'),
    system  = require(join(root_path, 'lib', 'system'));

var config_file = 'prey.conf',
    default_config_file = join(root_path, config_file + '.default'),
    config_path = program.path || system.paths.config,
    config      = require('getset').loadSync(join(config_path, config_file)),
    user_agent  = "Prey/" + version + " (Node.js, "  + system.os_name + ")";

common.root_path    = root_path;
common.version      = version;
common.program      = program;
common.os_name      = system.os_name;
common.system       = system;
common.config       = config;
common.config_path  = config_path;
common.default_config_file = default_config_file;
common.user_agent   = user_agent;

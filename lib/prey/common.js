var common = exports;

var join = require('path').join;
var root_path   = process.env.ROOT_PATH || join(__dirname, '..', '..');
var script_path = join(root_path, 'bin', 'prey.js');

// logger, version, command line args
var version = require(join(root_path, 'package')).version;
var program = require('commander');

// this needs to go before the log_stream part (os.log_file_path)
var os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
var os      = exports.os = require('./os/' + os_name);

// if run either through cron or trigger, log to os.log_file_path
var log_stream = (program.logfile || !process.env.TERM || process.env.TRIGGER)
    ? require('fs').createWriteStream(program.logfile || os.log_file_path) : null;

var logger = require('./logger').init((program.debug ? 'debug' : 'info'), {stream: log_stream});

var helpers     = require('./helpers');
var user_agent  = "Prey/" + version + " (Node.js, "  + os_name + ")";

var default_config_file = join(root_path, 'prey.conf.default');
var config_path = program.path || os.default_config_path;
var config_file = join(config_path, 'prey.conf');
var config      = require('getset').load(config_file);

var private_key_path = join(config_path, config.get('private_key'));
var certificate_path = join(config_path, config.get('certificate'));

// on windows process.env.TERM is undefined ...
var terminal = (os_name == "windows") ? "winterm" : process.env.TERM;

// exports
common.root_path    = root_path;
common.script_path  = script_path;
common.version      = version;
common.program      = program;
common.os_name      = os_name;
// common.os           = os;
common.logger       = logger;
common.helpers      = helpers;
common.user_agent   = user_agent;
common.config       = config;
common.config_path  = config_path;
common.terminal      = terminal;
common.default_config_file = default_config_file;
common.private_key_path    = private_key_path;
common.certificate_path    = certificate_path;

var join    = require('path').join,
    common  = require('./../common'),
    program = common.program,
    version = common.version,
    os_name = common.os_name,
    config  = common.config,
    paths   = common.system.paths,
    config_path = common.config_path;

// if run either through cron or trigger, log to os.log_file_path
var log_stream = (program.logfile || !process.env.TERM || process.env.TRIGGER)
    ? require('fs').createWriteStream(program.logfile || paths.log_file) : null;

common.logger = require('./logger')
                .init((program.debug ? 'debug' : 'info'), {stream: log_stream});

common.helpers     = require('./helpers');
common.user_agent  = "Prey/" + version + " (Node.js, "  + os_name + ")";

common.private_key_path = join(config_path, config.get('private_key'));
common.certificate_path = join(config_path, config.get('certificate'));

// on windows process.env.TERM is undefined ...
common.terminal = (os_name == "windows") ? "winterm" : process.env.TERM;

module.exports = common;

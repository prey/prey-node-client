var join    = require('path').join,
    common  = require('./../common'),
    program = common.program,
    version = common.version,
    os_name = common.os_name,
    config  = common.config,
    paths   = common.system.paths,
    config_path = common.config_path;

// cmd.exe doesnt set process.env.TERM but SESSIONNAME is
if (process.env.SESSIONNAME === 'Console') process.env.TERM = 'winterm';

// if run either through cron or trigger, log to os.log_file_path
var log_stream = (program.logfile || !process.env.TERM || process.env.TRIGGER)
    ? require('fs').createWriteStream(program.logfile || paths.log_file) : null;

common.logger = require('./logger')
                .init((program.debug ? 'debug' : 'info'), {stream: log_stream});

common.helpers     = require('./helpers');
common.providers   = require('./providers');

common.private_key_path = join(config_path, config.get('private_key'));
common.certificate_path = join(config_path, config.get('certificate'));

module.exports = common;

var join        = require('path').join,
    common      = require(join(__dirname, '..', 'common')),
    program     = common.program,
    version     = common.version,
    os_name     = common.os_name,
    config      = common.config,
    paths       = common.system.paths,
    config_path = common.config_path;

common.helpers     = require('./helpers');

// if run either through cron, trigger or windows service, log to file
var log_stream = (program.logfile || common.helpers.run_via_daemon())
    ? require('fs').createWriteStream(program.logfile || paths.log_file) : null;

common.logger = require('./logger')
                .init((program.debug ? 'debug' : 'info'), {stream: log_stream});

module.exports = common;

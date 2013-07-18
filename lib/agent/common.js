var join        = require('path').join,
    common      = require(join(__dirname, '..', 'common')),
    program     = common.program,
    paths       = common.system.paths;

common.helpers  = require('./helpers');

// if run either through cron, trigger or windows service, log to file
var log_stream = (program.logfile || (!process.stdout.isTTY || process.env.TERM == 'dumb'))
    ? require('fs').createWriteStream(program.logfile || paths.log_file) : null;

common.logger = require('./logger')
                .init((program.debug ? 'debug' : 'info'), {stream: log_stream});

module.exports = common;

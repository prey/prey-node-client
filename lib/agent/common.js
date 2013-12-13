var join        = require('path').join,
    common      = require(join(__dirname, '..', 'common')),
    program     = common.program,
    paths       = common.system.paths;

common.helpers  = require('./helpers');

var log_stream  = (program.logfile || common.helpers.running_on_background())
    ? require('fs').createWriteStream(program.logfile || paths.log_file) : null;

var log_level   = program.debug ? 'debug' : 'info';
common.logger   = require('./logger').init(log_level, { stream: log_stream });

module.exports  = common;

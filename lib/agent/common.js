
var join        = require('path').join,
    common      = require(join(__dirname, '..', 'common')),
    program     = common.program,
    paths       = common.system.paths,
    fs          = require('fs');

common.helpers  = require('./helpers');

var log_file    = (program.logfile || common.helpers.running_on_background())
                ? (program.logfile || paths.log_file) : null;

var log_level   = program.debug ? 'debug' : 'info';
var log_stream  = fs.createWriteStream(log_file, {flags: 'a'});

common.logger   = require('petit').new({ level: log_level,
                                         stream: log_stream });

module.exports  = common;

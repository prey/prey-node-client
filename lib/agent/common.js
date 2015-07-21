var join = require('path').join,
    common = require(join(__dirname, '..', 'common')),
    program = common.program,
    paths = common.system.paths;

common.helpers = require('./helpers');

var log_file = (program.logfile || common.helpers.running_on_background()) ? (program.logfile || paths.log_file) : null;

var log_level_cfg = common.config.get('log_level');
var log_level = log_level_cfg ? log_level_cfg : program.debug ? 'debug' : 'info';

common.logger = require('petit').new({
  level: log_level,
  file: log_file
});

module.exports = common;

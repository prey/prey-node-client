var join = require('path').join,
  common = require(join(__dirname, '..', 'common')),
  program = common.program,
  paths = common.system.paths;

common.helpers = require('./helpers');

var isInTest = typeof global.it === 'function';
var log_file =
  program.logfile || common.helpers.running_on_background()
    ? program.logfile || paths.log_file
    : null;

var log_level = process.env.DEBUG ? 'debug' : 'info';

if (isInTest) {
  log_level = 'critical';
}

common.logger = require('petit').new({
  level: log_level,
  file: log_file,
  rotate: true,
  size: 2000000,
  limit: 9,
  compress: true,
  dest: paths.config,
});

module.exports = common;

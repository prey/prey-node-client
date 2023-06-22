const path = require('path');
const helpers = require('./helpers');

const { join } = path;
// eslint-disable-next-line import/no-dynamic-require, prefer-const
let common = require(join(__dirname, '..', 'common'));

const { system, program } = common;
const { paths } = system;

const logLevel = process.env.DEBUG ? 'debug' : 'info';
const logFile =
  program.logfile || helpers.running_on_background()
    ? program.logfile || paths.logFile
    : null;

common.helpers = helpers;
common.logger = require('petit').new({
  level: logLevel,
  file: logFile,
  rotate: true,
  size: 2000000,
  limit: 9,
  compress: true,
  dest: paths.config,
});

module.exports = common;

const { join } = require('path');

// eslint-disable-next-line import/no-dynamic-require
const common = require(join(__dirname, '..', 'common'));
const { program } = common;
const { paths } = common.system;
const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const fs = require('fs');
const fetchEnvVar = require('../utils/fetch-env-var');

common.helpers = require('./helpers');
// TODO: fix the two commons imports
const logFile = program.logfile || common.helpers.running_on_background()
  ? program.logfile || paths.log_file
  : null;

const logLevel = fetchEnvVar('DEBUG') && fetchEnvVar('DEBUG').localeCompare('true') === 0 ? 'debug' : 'info';
common.logger = require('petit').new({
  level: logLevel,
  file: logFile,
  rotate: true,
  size: 2000000,
  limit: 9,
  compress: true,
  dest: paths.config,
});

common.logger_restarts = osName === 'windows' ? require('petit').new({
  level: logLevel,
  file: paths.log_restarts,
  rotate: false,
  size: 200,
  limit: 0,
  compress: false,
  dest: paths.config,
}) : () => {};

common.writeFileLoggerRestart = (textToWrite) => {
  if (!common.helpers.running_on_background() || osName !== 'windows') return;
  fs.appendFile(paths.log_restarts, `${textToWrite}\n`, () => {});
};

common.countLinesLoggerRestarts = () => {
  if (!common.helpers.running_on_background() || osName !== 'windows') return;
  const fileBuffer = fs.readFileSync(paths.log_restarts);
  const toString = fileBuffer.toString();
  const splitLines = toString.split('\n');
  if (splitLines.length > 5) {
    try {
      const fd = fs.openSync(paths.log_restarts, 'w');
      if (fd !== -1) {
        fs.writeSync(fd, splitLines.slice(1, 6).join('\n'));
        fs.closeSync(fd);
      } else {
        throw new Error('There was an error when trying to open the file');
      }
    } catch (err) {
      common.logger.info(`Error writing file ${paths.log_restarts}: ${err.message}`);
    }
  }
};

module.exports = common;

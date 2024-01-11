const { join } = require('path');

const common = require(join(__dirname, '..', 'common'));
const { program } = common;
const { paths } = common.system;
const os_name = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const fs = require('fs');

common.helpers = require('./helpers');

const log_file = program.logfile || common.helpers.running_on_background()
  ? program.logfile || paths.log_file
  : null;

const log_level = process.env.DEBUG ? 'debug' : 'info';
common.logger = require('petit').new({
  level: log_level,
  file: log_file,
  rotate: true,
  size: 2000000,
  limit: 9,
  compress: true,
  dest: paths.config,
});

common.logger_restarts = os_name === 'windows' ? require('petit').new({
  level: log_level,
  file: paths.log_restarts,
  rotate: false,
  size: 200,
  limit: 0,
  compress: false,
  dest: paths.config,
}) : () => {};

common.writeFileLoggerRestart = (textToWrite) => {
  if (!common.helpers.running_on_background() || os_name !== 'windows') return;
  fs.appendFile(paths.log_restarts, `${textToWrite}\n`, () => {});
};

common.countLinesLoggerRestarts = () => {
  if (!common.helpers.running_on_background() || os_name !== 'windows') return;
  const fileBuffer = fs.readFileSync(paths.log_restarts);
  const to_string = fileBuffer.toString();
  const split_lines = to_string.split('\n');
  if (split_lines.length > 5) { fs.writeFileSync(paths.log_restarts, split_lines.slice(1, 6).join('\n')); }
};

module.exports = common;

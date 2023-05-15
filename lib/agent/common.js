var join = require('path').join,
  common = require(join(__dirname, '..', 'common')),
  program = common.program,
  paths = common.system.paths
  fs = require('fs');

common.helpers = require('./helpers');

var log_file =
  program.logfile || common.helpers.running_on_background()
    ? program.logfile || paths.log_file
    : null;

var log_restarts = common.helpers.running_on_background() ? paths.log_restarts
  : null;

var log_level = process.env.DEBUG ? 'debug' : 'info';
common.logger = require('petit').new({
  level: log_level,
  file: log_file,
  rotate: true,
  size: 2000000,
  limit: 9,
  compress: true,
  dest: paths.config,
});

common.logger_restarts = require('petit').new({
  level: log_level,
  file: log_restarts,
  rotate: false,
  size: 200,
  limit: 0,
  compress: false,
  dest: paths.config,
});

common.writeFileLoggerRestart = (textToWrite) => {
  fs.appendFile(log_restarts, textToWrite + '\n', ()=>{});
};

common.countLinesLoggerRestarts = () => {
  const fileBuffer = fs.readFileSync(log_restarts);
  const to_string = fileBuffer.toString();
  const split_lines = to_string.split("\n");
  if(split_lines.length > 5)
      fs.writeFileSync(log_restarts, split_lines.slice(1, 6).join('\n'));
};

module.exports = common;

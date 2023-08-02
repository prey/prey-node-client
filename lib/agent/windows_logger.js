const fs = require('fs');

const helpers = require('./helpers');
const petit = require('petit');
const { paths } = require('../system');

const logLevel = process.env.DEBUG ? 'debug' : 'info';
const osName = process.platform
  .replace('win32', 'windows')
  .replace('darwin', 'mac');

if (osName === 'windows') {
  petit.new({
    level: logLevel,
    file: paths.log_restarts,
    rotate: false,
    size: 200,
    limit: 0,
    compress: false,
    dest: paths.config,
  });

  exports.writeFileRestart = () => {
    const textToWrite = Math.floor(new Date().getTime() / 1000).toString();
    if (!helpers.runningOnBackground()) return;
    fs.appendFile(paths.log_restarts, `${textToWrite}\n`, () => {});
  };

  exports.countLinesRestarts = () => {
    if (!helpers.runningOnBackground()) return;
    const fileBuffer = fs.readFileSync(paths.log_restarts);
    const splitLines = fileBuffer.toString().split('\n');
    if (splitLines.length > 5)
      fs.writeFileSync(paths.log_restarts, splitLines.slice(1, 6).join('\n'));
  };
}

const { join } = require('path');
const common = require('../../../common');

const { system } = common;
// eslint-disable-next-line camelcase
const { run_as_logged_user } = system;
// eslint-disable-next-line camelcase
const { tempfile_path } = common.system;

exports.get_screenshot = (callback) => {
  const filePath = tempfile_path(`screenshot.${process.pid}.jpg`);
  run_as_logged_user('del', ['/f', `${filePath}`], { timeout: 2500 }, () => {
    // eslint-disable-next-line consistent-return
    run_as_logged_user(`${join(__dirname, 'preyshot.exe')}`, [`${filePath}`], { timeout: 2500 }, (error) => {
      if (error) return callback(error);
      callback(null, filePath, 'image/jpeg');
    });
  });
};

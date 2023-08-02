const { join } = require('path');
const common = require('../../../../common');

const system = require('../../../../system');

const runAsUser = system.run_as_logged_user;
const tempPath = system.tempfile_path;

exports.get_screenshot = (callback) => {
  const filePath = tempPath(`screenshot.${process.pid}.jpg`);

  runAsUser(`${join(__dirname, 'preyshot.exe')}`, [`${filePath}`], () => {
    callback(null, filePath, 'image/jpeg');
  });
};

const path = require('path');
const common = require('../../../common');

const { system } = common;
const runAsUser = system.run_as_logged_user;

const tempPath = system.tempfile_path;
/**
 * Generates a screenshot and returns the file path and image type.
 *
 * @param {function} callback - The callback function to be called when the screenshot is generated.
 * @return {void} Returns nothing.
 */
exports.get_screenshot = (callback) => {
  const filePath = tempPath('screenshot.jpg');
  runAsUser(`del /f ${filePath}`, [], { timeout: 2500 }, () => {
    try {
      runAsUser(`${path.join(__dirname, 'preyshot.exe')}`, [`${filePath}`], { timeout: 2500 }, () => {
        callback(null, filePath, 'image/jpeg');
      });
    } catch (error) {
      callback(null, filePath, 'image/jpeg');
    }
  });
};

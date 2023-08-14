const fs = require('fs');
const { join } = require('path');
const { exec } = require('child_process');
const common = require('../../common');

const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const { tempfile_path } = common.system;
const exe = '/prey-webcam.exe';
const opts = ' -invalid youcam,cyberlink,google,rear -frame 10 -outfile ';
const filePath = tempfile_path(`extra_attachment.${process.pid}.jpg`);
const pictureCommand = `"${join(__dirname, '..', 'webcam', 'windows', exe)}"${opts}${filePath}`;

/**
 * Takes a picture using the webcam and calls the provided callback function.
 *
 * @param {function} callback - The callback function to be called after the picture is taken.
 * @return {undefined} - This function does not return a value.
 */
const takePicture = (callback) => {
  // eslint-disable-next-line consistent-return
  exec(pictureCommand, { timeout: 2500 }, (err) => {
    if (err) return callback(err);
    const exists = fs.existsSync(filePath);
    if (exists) callback(null, { file: filePath, content_type: 'image/jpeg' });
    callback(err || new Error('Couldnt grab extra picture using the webcam.'));
  });
};
/**
 * Retrieves an extra attachment using the webcam on Windows.
 *
 * @param {function} callback - The callback function to handle the result.
 * @return {void}
 */
// eslint-disable-next-line consistent-return
exports.get_extra_attachment = (callback) => {
  if (osName !== 'windows') return callback(new Error('Only available on windows'));
  fs.unlink(filePath, () => {
    takePicture(callback);
  });
};

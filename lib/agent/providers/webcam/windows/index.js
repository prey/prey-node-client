const fs = require('fs');
const { join } = require('path');
const { exec } = require('child_process');
const common = require('../../../common');

const tempPath = common.system.tempfile_path;
const exes = ['/prey-webcam.exe', '/snapshot.exe'];
const opts = [' -invalid youcam,cyberlink,google -frame 10 -outfile ', ' /T '];
const file = tempPath('picture.jpg');
const pictureCommand = (index, fileText) => `"${join(__dirname, exes[index])}"${opts[index]}${fileText}`;
/**
 * Takes a picture and returns the file path and image type.
 *
 * @param {function} callback - The callback function to be called when the picture is taken.
 * @return {string} The file path of the picture.
 * @return {string} The image type of the picture.
 */
const takePicture = (callback) => {
  const fileReplaced = file.replace(/.jpg/g, '');
  exec(pictureCommand(1, fileReplaced), { timeout: 2500 }, () => {
    if (!fs.existsSync(fileReplaced)) {
      exec(pictureCommand(0, file), { timeout: 20000 }, () => {
        callback(null, file, 'image/jpeg');
      });
    } else {
      callback(null, `${fileReplaced}.jpg`, 'image/jpeg');
    }
  });
};
/**
 * Deletes the existing picture file and takes a new picture.
 *
 * @param {function} callback - The callback function to be executed after taking the picture.
 * @return {undefined} - This function does not return a value.
 */
exports.get_picture = (callback) => {
  fs.unlink(file, () => {
    takePicture(callback);
  });
};

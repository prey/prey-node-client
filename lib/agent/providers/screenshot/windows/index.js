const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const common = require('../../../common');

const { system } = common;

const tempPath = system.tempfile_path;
/**
 * Generates a screenshot and returns the file path and image type.
 *
 * @param {function} callback - The callback function to be called when the screenshot is generated.
 * @return {void} Returns nothing.
 */
exports.get_screenshot = (callback) => {
  const currentDate = new Date();
  const timestamp = currentDate.getTime();
  const filePath = tempPath(`screenshot.${timestamp}.jpg`);
  const nircmd = spawn(path.join(__dirname, 'nircmd.exe'), ['savescreenshotfull', filePath], { timeout: 2500 });
  exec(`del /f ${filePath}`, { timeout: 2500 }, () => {
    nircmd.on('close', () => {
      try {
        fs.statSync(filePath);
        callback(null, filePath, 'image/jpeg');
      } catch (error) {
        exec(`${path.join(__dirname, 'nircmd.exe')} "${filePath}""`, { timeout: 2500 }, () => {
          callback(null, filePath, 'image/jpeg');
        });
      }
    });
  });
};

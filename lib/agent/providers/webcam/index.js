const fs = require('fs');
const common = require('../../common');

// eslint-disable-next-line import/no-dynamic-require, prefer-template
const osFunction = require('./' + common.os_name);
/**
 * Retrieves a picture using the osFunction module.
 *
 * @param {function} callback - The callback function to be executed once the picture is retrieved.
 * @return {undefined}
 */
exports.get_picture = (callback) => {
  // eslint-disable-next-line consistent-return
  osFunction.get_picture((err, filePath, fileType) => {
    try {
      if (err) {
        err.level = 'not fatal';
        return callback(err, null, 'picture');
      }
      if (fs.existsSync(filePath)) callback(null, { file: filePath, content_type: fileType }, 'picture');
      else callback(new Error("Couldn't grab a picture using the webcam."));
    } catch (error) {
      const errCPicture = error;
      errCPicture.level = 'not fatal';
      callback(errCPicture, null, 'picture');
    }
  });
};

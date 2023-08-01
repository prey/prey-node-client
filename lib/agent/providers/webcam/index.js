const fs = require('fs');
const { osName } = require('../../../common');

// eslint-disable-next-line import/no-dynamic-require, prefer-template
const osFunction = require(`./${osName}`);
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
      if (err) return callback(err);
      if (fs.existsSync(filePath)) callback(null, { file: filePath, content_type: fileType });
      else callback(err || new Error("Couldn't grab a picture using the webcam."));
    } catch (error) {
      callback(error);
    }
  });
};

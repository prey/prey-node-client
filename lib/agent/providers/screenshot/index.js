const fs = require('fs');
const common = require('../../../common');

// eslint-disable-next-line import/no-dynamic-require
const osFunctions = require(`./${common.osName}`);

exports.get_screenshot = (callback) => {
  // eslint-disable-next-line consistent-return
  osFunctions.get_screenshot((err, filePath, fileType) => {
    if (err) return callback(err);

    const exists = fs.existsSync(filePath);
    if (!exists) {
      return callback(new Error('Screenshot failed'));
    }

    const { size } = fs.statSync(filePath);
    if (size > 20000000) {
      return callback(new Error('Screenshot failed: Image is too heavy'));
    }
    callback(null, { file: filePath, content_type: fileType });
  });
};

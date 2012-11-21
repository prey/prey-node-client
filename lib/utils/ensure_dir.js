var fs = require('fs');

/**
 * Make sure the directory exists.
 **/
module.exports = function(path, callback) {
  fs.exists(path, function(exists) {
    if (exists) return callback();

    fs.mkdir(path, callback);
  });
};

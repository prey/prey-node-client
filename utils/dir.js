var fs = require('fs');

/**
 * Make sure the directory exists.
 **/
exports.ensure = function(path, callback) {
  fs.exists(path, function(exists) {
    if (exists) return callback(null);

    fs.mkdir(path, function(err) {
      if (err) return callback(_error(err));

      callback(null);
    });
  });
};

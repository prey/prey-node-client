var path = require('path'),
    os_name = process.platform,
    package_path  = path.resolve(__dirname, '..', '..'),
    paths = require(path.join(__dirname, os_name, 'paths'));

module.exports = require(path.join(__dirname, os_name));
module.exports.paths = paths;
module.exports.paths.package  = package_path;
module.exports.paths.bin_path = path.join(package_path, paths.prey_bin);
module.exports.os_name = os_name;

/**
 * Callsback name of currently logged in user.
 **/
module.exports.logged_user = function(callback){

  if (process.env.LOGGED_USER)
    return callback(null, process.env.LOGGED_USER);

  module.exports.get_logged_user(function(err, user_name) {
    if (err) return callback(err);

    if (user_name && user_name !== '')
      callback(null, user_name);
    else
      callback(new Error('No logged user found.'));
  });
};

module.exports.tempfile_path = function(filename){
  return path.join(module.exports.paths.temp, filename);
};

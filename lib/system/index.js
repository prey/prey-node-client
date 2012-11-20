var join = require('path').join,
    os_name = process.platform;

module.exports = require(join(__dirname, os_name));
module.exports.paths = require(join(__dirname, os_name, 'paths'));
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
  return join(module.exports.paths.temp, filename);
};

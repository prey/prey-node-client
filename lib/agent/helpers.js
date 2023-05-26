"use strict";

var semver      = require('semver'),
    exceptions  = require('../exceptions');

var helpers  = {};

helpers.running_on_background = function() {
  return helpers.run_via_service() || helpers.no_console_attached();
}

// returns true if no terminal attached, or stdout is not a tty
helpers.no_console_attached = function(){
  return (!process.stdout.isTTY || process.env.TERM == 'dumb');
}

helpers.run_via_service = function(){
  return (process.platform == 'win32' && !process.env.HOMEPATH);
}


// is_greater_than("1.3.10", "1.3.9") returns true
helpers.is_greater_than = function(first, second) {
  return semver_wrapper('gt', first, second);
};

helpers.is_greater_or_equal = function(first, second) {
  return semver_wrapper('gte', first, second);
};

function semver_wrapper(method_name, first, second) {
  var valid = validate_versions([first, second], method_name);

  return valid && semver[method_name](first, second);
}

function validate_versions(versions, method_name) {
  var invalid_versions = [];

  versions.forEach(function(el) {
    if(!semver.valid(el)) {
      invalid_versions.push(el);
    }
  });

  if(invalid_versions.length > 0) {
    // For now the exception is removed because it's been sent for all OS version above 10.6.0
    // handle_version_error(method_name, invalid_versions);
    return false;
  }
  return true;
}

function handle_version_error(method_name, versions) {
  var err_msg = "Cannot run" + method_name + ". Invalid versions: ";
  err_msg = err_msg.concat(versions.join(" "));
  exceptions.send(new Error(err_msg));
}

module.exports = helpers;

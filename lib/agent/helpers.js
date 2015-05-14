"use strict";

var semver = require('semver');

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
  [first, second].forEach(function (el, i) {
    if(!semver.valid(el)) {
      first = second = "0.0.1";
    }
  });

  return semver.gt(first, second);
};

module.exports = helpers;

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
  var invalid = [];

  [first, second].forEach(function (el, i) {

    if(!semver.valid(el)) {

      var label = i === 0 ? "first" : "second";
      invalid.push(label);
    }

  });

  if (invalid.length > 0) {
    first = second = "0.0.1";
    exceptions.send(new Error("Cannot run is_greater_than: Invalid version"+ invalid));
  }

  return semver.gt(first, second);
};

module.exports = helpers;

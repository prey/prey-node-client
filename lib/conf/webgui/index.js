var fs      = require('fs'),
    join    = require('path').join,
    spawn   = require('child_process').spawn,
    common  = require('./../../common'),
    agent   = require('./../../agent'),
    lp      = require('./../long-polling')
    shared  = require('../shared');

var exec   = require('child_process').exec,
    secure = require('./../../agent/plugins/control-panel/secure');

function log(str) {
  shared.log(str);
}

exports.check_and_show = function(values, cb) {
  var force = values['-f'] === true;
  var device_key = shared.keys.get().device || '';

  if (device_key) {
    if (force) {
      device_key = '';
      shared.keys.del();
      log("Forcing new device configuration, deleting previous credentials...")
      secure.open_config(device_key, function() {
        log("Running web configurator")
      });
    } else
      log("Device already set! Run with -f/--force to configure a different device.")
  }

  if (!device_key) console.log("NO DEVICE KEY!!!")
  secure.open_config(device_key, function() {
    console.log("OA");
  });

}

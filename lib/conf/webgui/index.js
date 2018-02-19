var shared       = require('../shared'),
    secure       = require('./../../agent/plugins/control-panel/secure'),
    long_polling = require('./../../agent/plugins/control-panel/long-polling'),
    exec         = require('child_process').exec,
    gui          = require('./../gui');
    os_name      = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

var device_key,
    process_id;

function log(str) {
  shared.log(str);
}

var force_new_config = function() {
  shared.keys.del();

  if (os_name == 'windows') {
    process_id = `for /f "tokens=2 delims=," %F in ('tasklist /nh /fi "imagename eq node.exe" /fo csv') do @echo %~F`
  } else {
    process_id = "ps -A | grep -m1 prx | awk '{print $1}'";
  }

  exec(restart_cmd, function(err, pid) {
    if (err) return log("Error forcing a new configuration:" + err)
    pid = pid.split("\r\n").slice(0, -1)[0];
    process.kill(pid, 'SIGHUP');
  })

  log("Forcing device configuration, deleting previous credentials...")
}

var show = function(force) {
  shared.keys.verify_current(function(err) {
    if (!err) { // no error, meaning existing keys are valid
      log('Valid existing keys found. Proceeding anyway.')
      device_key = shared.keys.get().device;
    } else if (err && (err.code == 'INVALID_CREDENTIALS' || err.code == 'INVALID_DEVICE_KEY')) {
      log(err.message);
      force_new_config();
    }

    if (device_key) 
      log("Device already set! Run with -f/--force to reconfigure this device.");

    log('Firing up config webgui!');
    secure.open_config(device_key, function(err) {
      // If the webgui fails, open the regular gui
      log("Error launching webgui: " + err)
      if (err) gui.check_and_show([]);
    });
  });
}

exports.check_and_show = function(values, cb) {
  var force = values['-f'] === true;

  if (force) force_new_config();
  show(force);

}

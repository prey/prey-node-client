var join = require('path').join,
  exec = require('child_process').exec,
  shared = require('../shared'),
  gui = require('./../gui'),
  paths = require('./../../system/paths'),
  control_panel = join(
    paths.package,
    'lib',
    'agent',
    'plugins',
    'control-panel'
  ),
  secure = require(join(control_panel, 'secure')),
  osName = process.platform
    .replace('darwin', 'mac')
    .replace('win32', 'windows');

exports.device_key = null;
var process_id, restart_cmd;

function log(str) {
  shared.log(str);
}

var client_pid = function (cb) {
  if (osName == 'windows') {
    process_id = `for /f "tokens=2 delims=," %F in ('tasklist /nh /fi "imagename eq node.exe" /fo csv') do @echo %~F`;
  } else {
    var awk = osName == 'mac' ? 2 : 1;
    process_id = "ps -u prey | grep prx | awk '{print $'" + awk + "'}'";
  }

  exec(process_id, function (err, pid) {
    if (err) return cb('Error forcing a new configuration:' + err);
    pid = pid.toString().split('\r\n')[0];
    cb(null, pid);
  });
};

var force_new_config = function () {
  log('Forcing device configuration, deleting previous credentials...');
  shared.keys.del();
  exports.device_key = null;

  client_pid(function (err, pid) {
    if (err) log(err);
    restart_cmd = osName == 'windows' ? 'taskkill /F /PID ' : 'kill -9 ';

    setTimeout(function () {
      // Wait for the keys to be deleted
      exec(restart_cmd + pid);
    }, 1000);
  });
};

var reset_old_keys = function (reset, cb) {
  if (!reset) return cb();
  log('Renewing old security keys...');
  secure.reset_keys(function (err) {
    return cb && cb(err);
  });
};

var show = function () {
  log('Firing up config panel!');
  log(
    'A browser tab will now open and direct you to the device link process. If you encounter any issue please visit:'
  );
  log(
    'https://help.preyproject.com/article/257-how-to-troubleshoot-a-desktop-prey-configuration'
  );

  secure.open_config(exports.device_key, function (err) {
    // If the panel configurator fails, open the regular gui
    if (err) {
      log(
        'Error launching panel config' +
          (err.message.includes('ENOENT') ? ': ENOENT' : err.message)
      );
      gui.check_and_show([]);
    }
  });
};

exports.check_and_show = function (values) {
  var force = values['-f'] === true;
  var reset = values['-r'] || values['--reset-keys'];
  exports.device_key = null;

  exports.reset_old_keys(reset, function (err) {
    if (err) log('Unable to renew keys. Proceeding anyway');
    shared.keys.verify_current(function (err) {
      if (err) {
        if (
          err.code == 'INVALID_CREDENTIALS' ||
          err.code == 'INVALID_DEVICE_KEY'
        ) {
          exports.force_new_config();
        }
      } else {
        log('Valid existing keys found. Proceeding anyway.');
        exports.device_key = shared.keys.get().device;
        force || reset
          ? exports.force_new_config()
          : log(
              'Device already set! Run with -f/--force to reconfigure this device.'
            );
      }
      setTimeout(exports.show, 200);
    });
  });
};

exports.show = show;
exports.force_new_config = force_new_config;
exports.reset_old_keys = reset_old_keys;

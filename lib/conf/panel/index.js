const { join } = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const shared = require('../shared');
const paths = require('../../system/paths');
const edrLog = require('../../system/windows/edr_log');

const controlPanel = join(paths.package, 'lib', 'agent', 'control-panel');
const secure = require(join(controlPanel, 'secure'));
const osName = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

exports.device_key = null;

const log = (str) => shared.log(str);

const client_pid = (cb) => {
  const awk = osName === 'mac' ? 2 : 1;
  const cmd = `ps -u prey | grep prx | awk '{print $'" ${awk} "'}'`;
  exec(cmd, { timeout: 5000 }, (err, pid) => {
    if (err) return cb(`Error forcing a new configuration: ${err}`);
    cb(null, pid.toString().split('\r\n')[0]);
  });
};

const force_new_config = () => {
  log('Forcing device configuration, deleting previous credentials...');
  shared.keys.del();
  exports.device_key = null;

  if (osName === 'windows') {
    fs.readFile(join(paths.temp, 'prey.pid'), (err, data) => {
      if (err) { edrLog(`force_new_config: pidfile read failed (${err.message})`); return log(`Error forcing new config: ${err}`); }
      const pid = Number.parseInt(data.toString().trim(), 10);
      edrLog(`force_new_config: scheduling taskkill /F /PID ${pid} in 1s`);
      setTimeout(() => exec(`taskkill /F /PID ${pid}`, { timeout: 5000 }, (e) => {
        if (e) edrLog(`force_new_config: taskkill ${pid} failed (${e.message})`);
        else edrLog(`force_new_config: taskkill ${pid} OK`);
      }), 1000);
    });
  } else {
    client_pid((err, pid) => {
      if (err) return log(err);
      setTimeout(() => exec(`kill -9 ${pid}`, { timeout: 5000 }), 1000);
    });
  }
};

const reset_old_keys = (reset, cb) => {
  if (!reset) return cb();
  log('Renewing old security keys...');
  secure.reset_keys((err) => cb && cb(err));
};

const show = () => {
  log('Firing up config panel!');
  log('A browser tab will now open and direct you to the device link process. If you encounter any issue please visit:');
  log('https://help.preyproject.com/article/257-how-to-troubleshoot-a-desktop-prey-configuration');

  secure.open_config(exports.device_key, (err) => {
    if (err) {
      const errMsg = err.message.includes('ENOENT') ? 'ENOENT' : err.message;
      log(`Error launching panel config: ${errMsg}`);
    }
  });
};

exports.check_and_show = (values) => {
  const force = values['-f'] === true;
  const reset = values['-r'] || values['--reset-keys'];
  exports.device_key = null;

  exports.reset_old_keys(reset, (err) => {
    if (err) log('Unable to renew keys. Proceeding anyway');
    shared.keys.verify_current((sharedErr) => {
      if (sharedErr) {
        if (sharedErr.code === 'INVALID_CREDENTIALS' || sharedErr.code === 'INVALID_DEVICE_KEY')
          exports.force_new_config();
      } else {
        log('Valid existing keys found. Proceeding anyway.');
        exports.device_key = shared.keys.get().device;
        if (force || reset) {
          exports.force_new_config();
        } else {
          log('Device already set! Run with -f/--force to reconfigure this device.');
        }
      }
      setTimeout(exports.show, 200);
    });
  });
};

exports.show = show;
exports.force_new_config = force_new_config;
exports.reset_old_keys = reset_old_keys;

// @ts-check
/* eslint-disable consistent-return */
/* eslint-disable global-require */
/// ///////////////////////////////////////
// Prey Node.js Windows Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
/// ///////////////////////////////////////
const path = require('path');

const os = require('os');
const needle = require('needle');
const cp = require('child_process');
const { osInfo } = require('../../agent/utils/utilinformation');
const paths = require('../paths');

const { exec } = cp;
const { spawn } = cp;
const osName = os.platform().replace('win32', 'windows');

const LOCALHOST_ACTION = 'http://127.0.0.1:7739/action';
const LOCALHOST_PROVIDER = 'http://127.0.0.1:7739/provider';
const LOCALHOST_UPDATE = 'http://127.0.0.1:7739/update';

exports.monitoring_service_go = false;
// add windows bin path to env
process.env.PATH = `${process.env.PATH};${path.join(__dirname, 'bin')}`;
const binPath = (executable) => path.join(__dirname, 'bin', executable);
const { cleanString } = require('../../utils/string');
/**
 * @param {string} processName
 * @param {(running: boolean) => void} callback
 */
exports.process_running = function (processName, callback) {
  const cmd = `tasklist /fi "imagename eq ${processName}"`;
  try {
    exec(cmd, { timeout: 8000, cwd: __dirname }, (_err, stdout) => {
      const bool = stdout && stdout.toString().indexOf(processName) !== -1;
      if (typeof callback !== 'function') return;
      callback(!!bool);
    });
  } catch (e) {
    if (typeof callback === 'function') callback(false);
  }
};
exports.get_os_name = (callback) => {
  if (typeof callback !== 'function') return;
  callback(null, osName);
};
exports.get_os_version = (cb) => {
  const release = os.release();
  if (!release || release.trim() === '') {
    if (typeof cb !== 'function') return;
    cb(new Error('Unable to determine Windows version.'));
  } else {
    if (typeof cb !== 'function') return;
    cb(null, release.trim());
  }
};
/**
 * @param {(err: Error|null, user?: string) => void} callback
 */
exports.find_logged_user = (callback) => {
  const common = require('../../agent/common');
  const gte = common.helpers.is_greater_or_equal;
  /**
   * @param {Error|null} err
   * @param {string} stdout
   */
  const done = (err, stdout) => {
    if (err) {
      if (typeof callback !== 'function') return;
      return callback(err);
    }
    const out = stdout.toString().split('\\');
    const user = cleanString(out[out.length - 1]);
    if (!user || user === '' || user === 'undefined') {
      if (typeof callback !== 'function') return;
      return callback(err || new Error('No logged user found.'));
    }
    callback(null, user);
  };

  // Get current logged user
  try {
    exec('powershell -NoProfile -Command "(Get-WmiObject -Class win32_computersystem).UserName"', { timeout: 10000, cwd: __dirname }, (err, psout) => {
      if (err || psout.toString().trim() === '') {
        if (typeof callback !== 'function') return;
        return callback(new Error('No logged user found.'));
      }
      // Sanitize before interpolation into the next PowerShell command (H1: injection prevention)
      const username = cleanString((psout.split('\\').pop() || '').trim());

      // On Windows versions lower than 10 just return the username
      if (!gte(common.os_release, '10.0.0')) return done(null, psout);

      // Get the session ID from the current logged user
      try {
        exec(
          `powershell -NoProfile -Command "Get-WmiObject Win32_Process | Where-Object { $_.Name -eq 'explorer.exe' -and $_.GetOwner().User -eq '${username}' } | Select-Object -ExpandProperty SessionId"`,
          { timeout: 10000, cwd: __dirname },
          (errPower, sidout) => {
            if (errPower) return done(null, psout);

            const targetSessionID = parseInt(sidout.trim(), 10);
            if (Number.isNaN(targetSessionID)) return done(null, psout);

            // Get locked session id's and compare with the current one
            try {
              exec('powershell -NoProfile -Command "(Get-Process -Name LogonUI -ErrorAction SilentlyContinue).SessionId"', { timeout: 10000, cwd: __dirname }, (errPowerGet, lockedSid) => {
                if (errPowerGet) return done(null, psout);
                const sessionIds = lockedSid.split('\n').filter((sessionId) => sessionId.trim() !== '').map((id) => parseInt(id.trim(), 10));

                if (sessionIds.includes(targetSessionID)) {
                  if (typeof callback !== 'function') return;
                  return callback(new Error(`${psout.toString().trim()} - System on Windows Lock Screen state.`));
                }
                return done(null, psout);
              });
            } catch (e) {
              // Fallback: if LogonUI check fails, return username without lock screen verification
              return done(null, psout);
            }
          },
        );
      } catch (e) {
        // Fallback: if session-ID lookup fails, return username without lock screen verification
        return done(null, psout);
      }
    });
  } catch (e) {
    if (typeof callback === 'function') callback(/** @type {Error} */ (e));
  }
};
exports.get_os_edition = (callback) => {
  if (osName !== 'windows') {
    if (typeof callback !== 'function') return;
    return callback(new Error('Only for Windows'));
  }

  osInfo((stdoutsi) => {
    if (!stdoutsi || !stdoutsi.distro || stdoutsi.distro.toString().trim() === '') {
      if (typeof callback !== 'function') return;
      return callback(new Error('No edition found.'));
    }
    let edition = stdoutsi.distro.split(' ').splice(3)[0];
    if (edition === 'Business') edition = 'Pro';
    if (typeof callback !== 'function') return;
    callback(null, edition);
  });
};
exports.get_winsvc_version = (callback) => {
  const common = require('../../agent/common');
  const gte = common.helpers.is_greater_or_equal;
  if (osName !== 'windows' || !gte(common.os_release, '10.0.0')) {
    if (typeof callback !== 'function') return;
    return callback(null, null);
  }
  try {
    exec(`${path.join(paths.install, 'wpxsvc.exe')} -winsvc=version`, { timeout: 8000 }, (err, stdout) => {
      if (err) {
        if (typeof callback !== 'function') return;
        return callback(null, null);
      }
      const serviceVersion = stdout.split('\n')[0];
      callback(null, serviceVersion);
    });
  } catch {
    if (typeof callback !== 'function') return;
    return callback(null, null);
  }
};
exports.scan_networks = function (cb) {
  const cmdPath = binPath('wlanscan.exe');
  try {
    const child = spawn(cmdPath, ['/triggerscan'], {});
    child.on('exit', () => {
      if (typeof cb !== 'function') return;
      cb();
    });
  } catch (e) {
    return cb();
  }
};

exports.check_service = (data, cb) => {
  if (exports.monitoring_service_go) {
    if (typeof cb !== 'function') return;
    return cb(null, data);
  }
  needle.get(LOCALHOST_ACTION, (err) => {
    if (err) {
      if (typeof cb !== 'function') return;
      return cb(new Error('Admin service not available'), data);
    }
    exports.monitoring_service_go = true;
    if (typeof cb !== 'function') return;
    return cb(null, data);
  });
};

exports.updateAsAdmin = (data, cb) => {
  const opts = {
    timeout: 90000,
    json: true,
  };
  needle.post(`${LOCALHOST_UPDATE}?target=${data}`, null, opts, (err, resp) => {
    if (err) {
      if (typeof cb !== 'function') return;
      return cb(err);
    }
    if (resp?.statusCode !== 200) return cb(new Error('Unable to update provider'));
    cb();
  });
};

exports.get_as_admin = function (provider, cb) {
  const body = {
    provider,
  };
  const opts = {
    timeout: 90000,
    json: true,
  };
  needle.post(LOCALHOST_PROVIDER, body, opts, (err, resp, bodyResp) => {
    if (err) {
      if (typeof cb !== 'function') return;
      return cb(err);
    }
    let data;
    try {
      data = JSON.parse(bodyResp);
    } catch (e) {
      return cb(new Error('Unable to parse provider data'));
    }
    const out = data && data.output ? data.output : null;
    return cb(null, out);
  });
};
exports.run_as_admin = (command, opts, cb) => {
  const body = {
    action: command,
    key: opts.key,
    token: opts.token,
    opts: opts.dirs,
    optsKeep: opts.dir_keep,
  };
  needle.post(LOCALHOST_ACTION, body, { json: true, timeout: 120000 }, (err, _resp, bodyResp) => {
    if (err) {
      if (typeof cb !== 'function') return;
      return cb(err);
    }
    let data;
    try {
      data = JSON.parse(bodyResp);
    } catch (e) {
      if (typeof cb !== 'function') return;
      return cb(new Error('Unable to parse action data'));
    }
    const out = data && data.output ? data.output : null;
    if (typeof cb !== 'function') return;
    return cb(null, out);
  });
};
/**
 * @param {(lang: string) => void} cb
 */
exports.get_lang = function (cb) {
  let lang = 'en';
  const regPath = path.join('hklm', 'system', 'controlset001', 'control', 'nls', 'language');
  const cmd = `reg query ${regPath} /v Installlanguage`;
  try {
    exec(cmd, { timeout: 5000, cwd: __dirname }, (err, stdout) => {
      if (!err && stdout.includes('0C0A')) lang = 'es';
      if (typeof cb !== 'function') return;
      cb(lang);
    });
  } catch (e) {
    if (typeof cb === 'function') cb(lang);
  }
};
/**
 * @param {(err: Error|null, hostname?: string) => void} callback
 */
exports.get_current_hostname = (callback) => {
  try {
    exec('hostname', { timeout: 5000, cwd: __dirname }, (err, stdout) => {
      if (err) {
        if (typeof callback !== 'function') return;
        return callback(err);
      }
      if (typeof callback !== 'function') return;
      callback(null, stdout.split('\r\n')[0]);
    });
  } catch (e) {
    if (typeof callback === 'function') callback(/** @type {Error} */ (e));
  }
};

exports.compatible_with_module_tpm = function (data) {
  const editions = ['Pro', 'Education', 'Enterprise'];
  const common = require('../../agent/common');
  const gte = common.helpers.is_greater_or_equal;
  if (data.os_name === 'windows' && gte(os.release().trim(), '10.0.0')
      && data.os_edition && editions.includes(data.os_edition)
      && data.winsvc_version && gte(data.winsvc_version, '2.0.0')) return true;
  return false;
};

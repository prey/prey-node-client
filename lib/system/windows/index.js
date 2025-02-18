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
const { users, osInfo } = require('../../agent/utils/utilinformation');
const paths = require('../paths');

const { exec } = cp;
const { spawn } = cp;
const osName = os.platform().replace('win32', 'windows');

const LOCALHOST_ACTION = 'http://127.0.0.1:7739/action';
const LOCALHOST_PROVIDER = 'http://127.0.0.1:7739/provider';

exports.monitoring_service_go = false;
// add windows bin path to env
process.env.PATH = `${process.env.PATH};${path.join(__dirname, 'bin')}`;
const binPath = (executable) => path.join(__dirname, 'bin', executable);
const cleanString = (str) => str.replace(/[^A-Za-z0-9\s]/g, '_').trim();
exports.process_running = function (processName, callback) {
  const cmd = `tasklist /fi "imagename eq ${processName}"`;
  exec(cmd, (err, stdout) => {
    const bool = stdout && stdout.toString().indexOf(processName) !== -1;
    if (typeof callback !== 'function') return;
    callback(!!bool);
  });
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
exports.find_logged_user = (callback) => {
  var common = require('./../../agent/common'),
      logger = common.logger;
  const gte = common.helpers.is_greater_or_equal;
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
  exec('powershell -Command "(Get-WmiObject -Class win32_computersystem).UserName"', (err, psout) => {
    if (err || psout.toString().trim() == '') return callback(new Error('No logged user found.'));

    let username = psout.split("\\").pop().trim();
    logger.info("CP NAME: " + psout)
    logger.info("CP USER: " + username)
    let targetSessionID;

    // On Windows versions lower than 10 just return the username
    if (!gte(common.os_release, '10.0.0')) return done(null, psout);

    // Get the session ID from the current logged user 
    exec(`powershell -Command "Get-WmiObject Win32_Process | Where-Object { $_.Name -eq 'explorer.exe' -and $_.GetOwner().User -eq '${username}' } | Select-Object -ExpandProperty SessionId"`, (err, sidout) => {
      if (err) return done(null, psout);

      targetSessionID = parseInt(sidout.trim());
      if (isNaN(targetSessionID)) return done(null, psout);
      logger.info("TGID: " + targetSessionID)

      // Get locked session id's and compare with the current one
      exec('powershell -Command "(Get-Process -Name LogonUI -ErrorAction SilentlyContinue).SessionId"', (err, lockedSid) => {
        if (err) return done(null, psout);
        let sessionIds = lockedSid.split('\n').filter(sessionId => sessionId.trim() !== '').map(id => parseInt(id.trim(), 10));
        logger.info("SESSIONS: " + sessionIds)

        if (sessionIds.includes(targetSessionID)) {
          logger.info(`Session ID ${targetSessionID} is LOCKED!.`);
          return callback (new Error('System on Windows Lock Screen state.'));
        } else { 
          logger.info(`Session ID ${targetSessionID} is ACTIVE!.`);
        }
        return done(null, psout);

      });
    })
  });
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
  exec(`${path.join(paths.install, 'wpxsvc.exe')} -winsvc=version`, (err, stdout) => {
    if (err) {
      if (typeof callback !== 'function') return;
      return callback(null, null);
    }
    const serviceVersion = stdout.split('\n')[0];
    callback(null, serviceVersion);
  });
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
exports.get_lang = function (cb) {
  let lang = 'en';
  const regPath = path.join('hklm', 'system', 'controlset001', 'control', 'nls', 'language');
  const cmd = `reg query ${regPath} /v Installlanguage`;
  try {
    exec(cmd, (err, stdout) => {
      if (!err && stdout.includes('0C0A')) lang = 'es';
      if (typeof cb !== 'function') return;
      cb(lang);
    });
  } catch (e) {
    return cb(lang);
  }
};
exports.get_current_hostname = (callback) => {
  exec('hostname', (err, stdout) => {
    if (err) {
      if (typeof callback !== 'function') return;
      return callback(err);
    }
    if (typeof callback !== 'function') return;
    callback(null, stdout.split('\r\n')[0]);
  });
};
exports.get_python_version = (callback) => {
  if (typeof callback !== 'function') return;
  // Not necessary for now...
  return callback(null, null);
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

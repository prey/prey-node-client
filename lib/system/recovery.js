// @ts-check
const fs = require('fs');
const os = require('os');
const { join } = require('path');
const { execFile } = require('child_process');
const paths = require('./paths');

const VERSION_TIMEOUT_MS = 5000;

// rewire replaces this in tests.
const { platform } = process;

/**
 * Where the bundled remrecovery lives: in the active version's bin/ (current/bin)
 * on Windows, macOS and Linux. Null on any other platform.
 * @returns {string|null}
 */
const recoveryPath = () => {
  if (platform !== 'win32' && platform !== 'darwin' && platform !== 'linux') return null;
  const name = platform === 'win32' ? 'remrecovery.exe' : 'remrecovery';
  return join(paths.current, 'bin', name);
};

/** @returns {boolean} */
const exists = () => {
  const bin = recoveryPath();
  return Boolean(bin && fs.existsSync(bin));
};

/**
 * @param {(err: null, version: (string|null)) => void} cb
 */
// eslint-disable-next-line camelcase
const get_remrecovery_version = (cb) => {
  const bin = recoveryPath();
  if (!bin || !fs.existsSync(bin)) return cb(null, null);
  try {
    return execFile(bin, ['version'], { timeout: VERSION_TIMEOUT_MS, cwd: os.tmpdir() }, (err, stdout) => {
      if (err) return cb(null, null);
      return cb(null, String(stdout).split('\n')[0].trim() || null);
    });
  } catch (e) {
    return cb(null, null);
  }
};

// eslint-disable-next-line camelcase
module.exports = { recoveryPath, exists, get_remrecovery_version };

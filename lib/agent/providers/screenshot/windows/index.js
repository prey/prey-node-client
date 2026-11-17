// @ts-check
const fs = require('fs');
const path = require('path');
const common = require('../../../common');

const { system } = common;
const logger = common.logger.prefix('screenshot');
const runAsUser = system.run_as_logged_user;

const tempPath = system.tempfile_path;
const preyshotBin = path.join(__dirname, 'preyshot.exe');

// Slack for filesystem timestamp rounding. Any file older than this, relative to
// the start of the capture, was not written by this run of preyshot.
const MTIME_TOLERANCE_MS = 2000;

/**
 * Checks that the screenshot file was written by the current capture.
 * preyshot's exit code is not reliable (it exits with 1 even on success), so the
 * file's modification time is the only trustworthy signal: a stale file means
 * preyshot could not write it (e.g. no write permission over a file created by
 * another account) and must never be sent as a new screenshot.
 *
 * @param {string} filePath
 * @param {number} startedAt - Epoch ms when the capture started.
 * @param {(err: (Error|null), file?: string, type?: string) => void} callback
 */
const verifyFresh = (filePath, startedAt, callback) => {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats) return callback(new Error('Screenshot failed: no file generated'));

    if (stats.mtimeMs < startedAt - MTIME_TOLERANCE_MS) {
      return callback(new Error('Screenshot failed: stale file (preyshot could not write it)'));
    }

    return callback(null, filePath, 'image/jpeg');
  });
};

/**
 * Generates a screenshot and returns the file path and image type.
 *
 * @param {(err: (Error|null), file?: string, type?: string) => void} callback
 */
exports.get_screenshot = (callback) => {
  if (typeof callback !== 'function') return;

  const filePath = tempPath('screenshot.jpg');
  const startedAt = Date.now();

  // Removed by the agent itself: the previous `del` through safexec never worked,
  // since `del` is a cmd.exe builtin and safexec has no shell.
  fs.unlink(filePath, (unlinkErr) => {
    if (unlinkErr && unlinkErr.code !== 'ENOENT') {
      // Keep going: preyshot may still overwrite it, and verifyFresh decides.
      logger.debug(`Unable to remove previous screenshot: ${unlinkErr.message}`);
    }

    try {
      runAsUser(preyshotBin, [filePath], { timeout: 2500 }, (runErr) => {
        if (runErr) logger.debug(`preyshot finished with: ${runErr.message}`);
        verifyFresh(filePath, startedAt, callback);
      });
    } catch (error) {
      callback(/** @type {Error} */ (error));
    }
  });
};

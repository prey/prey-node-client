// @ts-check
const fs = require('fs');
const { join } = require('path');
const { exec } = require('child_process');
const common = require('../../../common');

const tempPath = common.system.tempfile_path;
const exes = ['/prey-webcam.exe', '/snapshot.exe'];
const opts = [' -invalid youcam,cyberlink,google -frame 10 -outfile ', ' /T '];
const file = tempPath('picture.jpg');

// A stable, writable working directory for spawned children. During an upgrade the
// process may inherit an invalid/read-only cwd (e.g. the version dir being replaced),
// which makes child_process spawn throw synchronously with `spawn EROFS`. Forcing a
// known-good cwd on every spawn avoids that failure mode.
const SAFE_CWD = join(process.env.WINDIR || String.raw`C:\Windows`, 'Temp');

const pictureCommand = (index, fileText) => `"${join(__dirname, exes[index])}"${opts[index]}${fileText}`;

// Exec options carry a known-good cwd (see SAFE_CWD above) to avoid `spawn EROFS`.
const snapshotOpts = { timeout: 2500, cwd: SAFE_CWD };
const webcamOpts = { timeout: 20000, cwd: SAFE_CWD };

/**
 * Takes a picture and returns the file path and image type.
 *
 * @param {(err: (Error|null), file?: string, type?: string) => void} callback - called
 * when the picture is taken.
 */
const takePicture = (callback) => {
  const fileReplaced = file.replace(/.jpg/g, '');
  try {
    exec(pictureCommand(1, fileReplaced), snapshotOpts, () => {
      if (!fs.existsSync(fileReplaced)) {
        try {
          exec(pictureCommand(0, file), webcamOpts, () => {
            callback(null, file, 'image/jpeg');
          });
        } catch (e) {
          // synchronous spawn throw (e.g. `spawn EROFS`) — deliver as a callback error
          callback(/** @type {Error} */ (e));
        }
      } else {
        callback(null, `${fileReplaced}.jpg`, 'image/jpeg');
      }
    });
  } catch (e) {
    // synchronous spawn throw (e.g. `spawn EROFS`) — deliver as a callback error
    callback(/** @type {Error} */ (e));
  }
};
/**
 * Deletes the existing picture file and takes a new picture.
 *
 * @param {(err: (Error|null), file?: string, type?: string) => void} callback - executed
 * after taking the picture.
 */
exports.get_picture = (callback) => {
  fs.unlink(file, () => {
    takePicture(callback);
  });
};

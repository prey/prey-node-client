const { exec } = require('child_process');
// eslint-disable-next-line camelcase
const { is_greater_than } = require('../../../helpers');
const common = require('../../../common');

const { system } = common;
// eslint-disable-next-line camelcase
const { run_as_logged_user } = system;
// eslint-disable-next-line camelcase
const { tempfile_path } = common.system;

const pictureTimeout = 10000;

let timer;
let child;
let running = true;

const pictureUtilData = {
  appPath: '',
  pictureDir: '',
  tmpPicture: '',
};
/**
 * Executes the callback function after the completion of a task.
 *
 * @param {Error} err - The error object, if any.
 * @param {string} filePath - The path of the file.
 * @param {function} cb - The callback function to be executed.
 * @return {undefined} Executes the callback function with the specified parameters.
 */
// eslint-disable-next-line consistent-return
const done = (err, filePath, cb) => {
  running = false;
  if (timer) clearTimeout(timer);
  if (err) return cb(err);
  cb(null, filePath, 'image/jpeg');
};
/**
 * Configures the picture user data.
 *
 * @param {string} user - the user's name
 * @param {number} userId - the user's ID
 */
const configurePictureUserData = () => {
  pictureUtilData.appPath = `${__dirname}/../../../utils/Prey.app`;
  pictureUtilData.pictureDir = '/tmp';
  pictureUtilData.tmpPicture = `${pictureUtilData.pictureDir}/picture.jpg`;
};

/**
 * Takes a picture.
 *
 * @param {function} cb - The callback function to be called after the picture is taken.
 * @return {undefined} No return value.
 */
const takePicture = (cb) => {
  // eslint-disable-next-line consistent-return
  child = run_as_logged_user(`open -n ${pictureUtilData.appPath}`, ['--args', '-picture'], (err) => {
    if (err) return cb(err);
    cb();
  });
};

/**
 * Generates the function comment for the given function body.
 *
 * @param {function} callback - The callback function to be called.
 * @return {undefined}
 */
exports.get_picture = (callback) => {
  // if after 10 seconds the picture hasn't been taken, cancel it.
  timer = setTimeout(() => {
    if (running && child) child.kill();
  }, pictureTimeout);

  if (is_greater_than('10.14.0', common.os_release)) {
    const filePath1014 = tempfile_path(`picture.${process.pid}.jpg`);
    child = exec(`"${__dirname}/imagesnap" -w 1 ${filePath1014}`, (err) => {
      done(err, filePath1014, callback);
    });
    return;
  }
  // Patch for MacOS Mojave and future versions
  // eslint-disable-next-line consistent-return
  common.system.get_logged_user((err, user) => {
    if (err || !user) return done(new Error(`Unable to get logged user: ${err.toString()}`), null, callback);
    // eslint-disable-next-line consistent-return
    configurePictureUserData();
    // eslint-disable-next-line consistent-return
    takePicture((errorTakePicture) => {
      if (errorTakePicture) return done(errorTakePicture, null, callback);
      setTimeout(() => {
        done(null, pictureUtilData.tmpPicture, callback);
      }, 3000);
    });
  });
};

exports.done = done;
exports.running = running;
exports.timer = timer;
exports.pictureUtilData = pictureUtilData;
exports.configurePictureUserData = configurePictureUserData;
exports.takePicture = takePicture;

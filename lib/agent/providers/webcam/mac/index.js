const { exec } = require('child_process');
const { is_greater_than } = require('../../../helpers');
const common = require('../../../common');
const { execAs } = require('../../../../system/utils/impersonate');

const { system } = common;
const { run_as_logged_user } = system;
const { tempfile_path } = common.system;

const pictureTimeout = 10000;

let timer;
let child;
let running = true;

const pictureUtilData = {
  userPath: '',
  picturePath: '',
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
const configurePictureUserData = (user, userId) => {
  const userIdGot = userId.toString().trim().split('\n')[0];

  pictureUtilData.userPath = `/Users/${user}`;
  pictureUtilData.picturePath = `${pictureUtilData.userPath}/Library/Containers/com.preypatchmojave/Data/picture.jpg`;
  pictureUtilData.appPath = `${__dirname}/../../../utils/Prey.app`;
  pictureUtilData.pictureDir = tempfile_path(userIdGot);
  pictureUtilData.tmpPicture = `${pictureUtilData.pictureDir}/picture.${process.pid}.jpg`;
};
/**
 * Retrieves the user ID for the given user.
 *
 * @param {string} user - The username of the user.
 * @param {function} cb - The callback function to be executed after retrieving the user ID.
 * @return {undefined} This function does not return a value.
 */
const getIdUser = (user, cb) => {
  // eslint-disable-next-line consistent-return
  exec(`id -u ${user}`, (err, userId) => {
    if (err || !userId) return cb(err);
    configurePictureUserData(user, userId);
    cb();
  });
};

/**
 * Deletes a picture.
 *
 * @param {function} cb - Callback function to be called after deleting the picture.
 * @return {undefined} No return value.
 */
const deletePicture = (user, cb) => {
  const cmd = `rm -f ${pictureUtilData.picturePath} ${pictureUtilData.tmpPicture}`;
  // eslint-disable-next-line consistent-return
  execAs(user, cmd, [], (err) => {
    if (err) return cb(err);
    cb();
  });
};
/**
 * Takes a picture.
 *
 * @param {function} cb - The callback function to be called after the picture is taken.
 * @return {undefined} No return value.
 */
const takePicture = (user, cb) => {
  // eslint-disable-next-line consistent-return
  child = execAs(user, `open -n ${pictureUtilData.appPath}`, ['--args', '-picture'], (err) => {
    if (err) return cb(err);
    cb();
  });
};
/**
 * Copies a file to a new location and creates a new directory if necessary.
 *
 * @param {function} cb - The callback function to be called after the file is copied.
 * @return {undefined} - No return value.
 */
const mvAndCopyFile = (user, cb) => {
  execAs(user, `mkdir ${pictureUtilData.pictureDir}`, [], () => {
    // eslint-disable-next-line consistent-return
    run_as_logged_user(`cp ${pictureUtilData.picturePath} ${pictureUtilData.tmpPicture}`, [], (err) => {
      if (err) return cb(new Error(err.toString()));
      cb(null);
    });
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
    getIdUser(user, (errorUserId) => {
      if (errorUserId) return done(new Error(`Unable to get user id: ${errorUserId.toString()}`), null, callback);
      // eslint-disable-next-line consistent-return
      deletePicture(user, (errorDeletePictures) => {
        if (errorDeletePictures) return done(new Error(`Unable to delete older pictures: ${errorDeletePictures.toString()}`), null, callback);
        // eslint-disable-next-line consistent-return
        takePicture(user, (errorTakePicture) => {
          if (errorTakePicture) return done(errorTakePicture, null, callback);
          setTimeout(() => {
            mvAndCopyFile(user, (errorMvAndCopy) => {
              done(errorMvAndCopy, pictureUtilData.tmpPicture, callback);
            });
          }, 3000);
        });
      });
    });
  });
};

exports.done = done;
exports.running = running;
exports.timer = timer;
exports.getIdUser = getIdUser;
exports.pictureUtilData = pictureUtilData;
exports.configurePictureUserData = configurePictureUserData;
exports.takePicture = takePicture;
exports.mvAndCopyFile = mvAndCopyFile;
exports.deletePicture = deletePicture;

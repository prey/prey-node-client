const { exec } = require('child_process');
const { is_greater_than } = require('../../../helpers');
const common = require('../../../common');
const { execAs } = require('../../../../system/utils/impersonate');

const { system } = common;
const { run_as_logged_user } = system;
const { tempfile_path } = common.system;

const screenshotTimeout = 10000;

let timer;
let child;
let running = true;

const screenshotUtilData = {
  userPath: '',
  screenshotPath: '',
  appPath: '',
  screenshotDir: '',
  tmpScreenshot: '',
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
 * Configures the screenshot user data.
 *
 * @param {string} user - the user's name
 * @param {number} userId - the user's ID
 */
const configureScreenshotUserData = (user, userId) => {
  const userIdGot = userId.toString().trim().split('\n')[0];

  screenshotUtilData.userPath = `/Users/${user}`;
  screenshotUtilData.screenshotPath = `${screenshotUtilData.userPath}/Library/Containers/com.preypatchmojave/Data/screenshot.jpg`;
  screenshotUtilData.appPath = `${__dirname}/../../../utils/Prey.app`;
  screenshotUtilData.screenshotDir = tempfile_path(userIdGot);
  screenshotUtilData.tmpScreenshot = `${screenshotUtilData.screenshotDir}/screenshot.${process.pid}.jpg`;
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
    configureScreenshotUserData(user, userId);
    cb();
  });
};

/**
 * Deletes a screenshot.
 *
 * @param {function} cb - Callback function to be called after deleting the screenshot.
 * @return {undefined} No return value.
 */
const deleteScreenshot = (user, cb) => {
  const cmd = `rm -f ${screenshotUtilData.screenshotPath} ${screenshotUtilData.tmpScreenshot}`;
  // eslint-disable-next-line consistent-return
  execAs(user, cmd, [], (err) => {
    if (err) return cb(err);
    cb();
  });
};
/**
 * Takes a screenshot.
 *
 * @param {function} cb - The callback function to be called after the screenshot is taken.
 * @return {undefined} No return value.
 */
const takeScreenshot = (user, cb) => {
  const cmd = `open -n ${screenshotUtilData.appPath}`;
  // eslint-disable-next-line consistent-return
  child = execAs(user, cmd, ['--args', '-screenshot'], (err) => {
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
  // eslint-disable-next-line consistent-return
  execAs(user, `mkdir ${screenshotUtilData.screenshotDir}`, [], () => {
    const cmd = `cp ${screenshotUtilData.screenshotPath} ${screenshotUtilData.tmpScreenshot}`;
    // eslint-disable-next-line consistent-return
    execAs(user, cmd, [], (err) => {
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
exports.get_screenshot = (callback) => {
  // if after 10 seconds the screenshot hasn't been taken, cancel it.
  timer = setTimeout(() => {
    if (running && child) child.kill();
  }, screenshotTimeout);

  if (is_greater_than('10.15.0', common.os_release)) {
    const filePath1015 = tempfile_path(`screenshot.${process.pid}.jpg`);
    child = exec('/usr/sbin/screencapture -t jpg -mx', (err) => {
      done(err, filePath1015, callback);
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
      deleteScreenshot(user, (errorDeletescreenshots) => {
        if (errorDeletescreenshots) return done(new Error(`Unable to delete older screenshots: ${errorDeletescreenshots.toString()}`), null, callback);
        // eslint-disable-next-line consistent-return
        takeScreenshot(user, (errorTakescreenshot) => {
          if (errorTakescreenshot) return done(errorTakescreenshot, null, callback);
          setTimeout(() => {
            mvAndCopyFile(user, (errorMvAndCopy) => {
              done(errorMvAndCopy, screenshotUtilData.tmpScreenshot, callback);
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
exports.screenshotUtilData = screenshotUtilData;
exports.configureScreenshotUserData = configureScreenshotUserData;
exports.takeScreenshot = takeScreenshot;
exports.mvAndCopyFile = mvAndCopyFile;
exports.deleteScreenshot = deleteScreenshot;

const { exec } = require('child_process');
// eslint-disable-next-line camelcase
const { is_greater_than } = require('../../../helpers');
const common = require('../../../common');

const socket = require('../../../socket');
const { nameArray } = require('../../../socket/messages');
const { system } = common;
// eslint-disable-next-line camelcase
const { run_as_logged_user } = system;
// eslint-disable-next-line camelcase
const { tempfile_path } = common.system;

const screenshotTimeout = 10000;

let timer;
let child;
let running = true;

const screenshotUtilData = {
  userPath: '',
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
 */
const configureScreenshotUserData = () => {
  screenshotUtilData.appPath = `${__dirname}/../../../utils/Prey.app`;
  screenshotUtilData.screenshotDir = '/tmp';
  screenshotUtilData.tmpScreenshot = `${screenshotUtilData.screenshotDir}/screenshot.jpg`;
};
/**
 * Retrieves the user ID for the given user.
 *
 * @param {string} user - The username of the user.
 * @param {function} cb - The callback function to be executed after retrieving the user ID.
 * @return {undefined} This function does not return a value.
 */
const getIdUser = (user, cb) => {
  configureScreenshotUserData(user);
  cb();
};

/**
 * Takes a screenshot.
 *
 * @param {function} cb - The callback function to be called after the screenshot is taken.
 * @return {undefined} No return value.
 */
const takeScreenshot = (cb) => {
  // eslint-disable-next-line consistent-return
  child = run_as_logged_user(`open -n ${screenshotUtilData.appPath}`, ['--args', '-screenshot'], (err) => {
    if (err) return cb(err);
    cb();
  });
};

exports.get_screenshot = (callback) => {
  socket.writeMessage(nameArray[3], (err, data) => {
    if (err) return exports.get_screenshot_old(callback);
    if ((typeof data.result === 'string' && data.result.length === 0)
    || (typeof data.result === 'boolean' && data.result === false))
      return done(new Error("Couldn't get screenshot"), null, callback);
    done(null, data.result, callback);
    // if (err) return get_screenshot_old(callback);
    // return done(null, data, callback);
  });
};

/**
 * Generates the function comment for the given function body.
 *
 * @param {function} callback - The callback function to be called.
 * @return {undefined}
 */
exports.get_screenshot_old = (callback) => {
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
    configureScreenshotUserData();
    // eslint-disable-next-line consistent-return
    takeScreenshot((errorTakescreenshot) => {
      if (errorTakescreenshot) return done(errorTakescreenshot, null, callback);
      setTimeout(() => {
        done(null, screenshotUtilData.tmpScreenshot, callback);
      }, 3000);
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

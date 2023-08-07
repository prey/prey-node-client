const join = require('path').join;
const { is_greater_than } = require('../../../helpers');
const common = require('../../../common');
const system = common.system;
const run_as_user = system.run_as_logged_user;
const temp_path = common.system.tempfile_path;
const exec = require('child_process').exec;

let timer;
let child;
let running = true;

let pictureUtilData= {
  user_path: '',
  picture_path: '',
  app_path: '',
  picture_dir: '',
  tmp_picture: '',
};

const done = (err, filePath, cb) => {
  running = false;
  if (timer) clearTimeout(timer);
  if (err) return cb(err);
  cb(null, filePath, 'image/jpeg');
};

const deletePicture = (picturePath, tmpPicture, cb) => {
  run_as_user(`rm ${picturePath} ${tmpPicture}`, [], () => { 
    cb ();
  })
};

const takePicture = (appPath, cb) => {
  child = run_as_user(`open -n ${appPath}`, ['--args', '-picture'], (err) => {
    if (err) return cb(err);
    cb();
  });
};

const mvAndCopyFile = (pictureDir, picturePath, tmpPicture, cb) => {
  run_as_user(`mkdir ${pictureDir}`, [], () => {
    run_as_user(`cp ${picturePath} ${tmpPicture}`, [], (err) => {
      if (err) return cb(new Error(err));
      cb(null);
    });
  });
};

exports.get_picture = (callback) => {
  const pictureTimeout = 10000;
  // if after 10 seconds the picture hasn't been taken, cancel it.
  timer = setTimeout(() => {
    if (running && child) child.kill();
  }, pictureTimeout);

  if (is_greater_than('10.14.0', common.os_release)) {
    let filePath1014 = temp_path(`picture.${process.pid}.jpg`);
    child = exec(`"${__dirname}/imagesnap" -w 1 ${filePath1014}`, (err) => {
      done(err, filePath1014);
    });
    return;
  }
  // Patch for MacOS Mojave and future versions
  common.system.get_logged_user((err, user) => {
    if (err || !user) return done(new Error('Unable to find logged user'), null, callback);

    exec(`id -u ${user}`, (err, user_id) => {
      user_id = user_id.toString().trim().split('\n')[0];

      pictureUtilData.user_path = `/Users/${user}`;
      pictureUtilData.picture_path = join(user_path, 'Library', 'Containers',
        'com.preypatchmojave', 'Data', 'picture.jpg');
      pictureUtilData.app_path = join(__dirname, '..', '..', '..', 'utils', 'Prey.app');
      pictureUtilData.picture_dir = temp_path(user_id);
      pictureUtilData.tmp_picture = join(picture_dir, `picture.${process.pid}.jpg`);

      // Delete previous picture if exists
      deletePicture(picture_path, tmp_picture, () => {
        takePicture(app_path, (errorTakePicture)=> {
          if (errorTakePicture) done(err, null, callback);
          setTimeout(() => {
            mvAndCopyFile(picture_dir, picture_path, tmp_picture, (errorMvAndCopy) => {
              done(errorMvAndCopy, tmp_picture, callback);
            });
          });
        });
      });
    });
  });
};

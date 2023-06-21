var join        = require('path').join,
    common      = require('./../../../common'),
    system      = common.system,
    run_as_user = system.run_as_logged_user,
    temp_path   = common.system.tempfile_path,
    exec        = require('child_process').exec;

const logger = common.logger.prefix('webcam');

// TODO: implment something
exports.requestPermission = () => {
  logger.info('requesting permission');
};

exports.get_picture = (callback) => {
  var timer,
      child,
      running = true,
      picture_timeout = 10000;

  var done = (err, file_path) => {
    running = false;
    if (timer) clearTimeout(timer);
    if (err) return callback(err);
    callback(null, file_path, 'image/jpeg');
  }

  if (common.osRelease < '10.14') {
    let file_path = temp_path('picture.' + process.pid + '.jpg');
    child = exec('"' + __dirname + '/imagesnap" -w 1 ' + file_path, (err, stdout, stderr) => {
      done(err, file_path);
    })

  } else {
    // Patch for MacOS Mojave and future versions
    common.system.get_logged_user((err, user) => {
      if (err || !user) return done(new Error('Unable to find logged user'));

      exec(`id -u ${user}`, (err, user_id) => {
        user_id = user_id.toString().trim().split('\n')[0];

        let user_path    = `/Users/${user}`,
            picture_path = join(user_path, 'Library', 'Containers', 'com.preypatchmojave', 'Data', 'picture.jpg'),
            app_path     = join(__dirname, '..', '..', '..', 'utils', 'Prey.app'),
            picture_dir  = temp_path(user_id),
            tmp_picture  = join(picture_dir, 'picture.' + process.pid + '.jpg')

        // Delete previous picture if exists
        run_as_user(`rm ${picture_path} ${tmp_picture}`, [], (err) => {
          // Run webcam app
          child = run_as_user(`open -n ${app_path}`, ['--args', '-picture'], (err, out) => {
            if (err) return done(err);

            setTimeout(() => {
              // Copy the photo to /tmp dir
              run_as_user(`mkdir ${picture_dir}`, [], () => {
                run_as_user(`cp ${picture_path} ${tmp_picture}`, [], (err) => {
                  if (err) return done(new Error('Check your camera permissions.'));
                  done(null, tmp_picture);
                })
              })
            }, 3000)
          })
        })
      })
    })
  }

  // if after 10 seconds the picture hasn't been taken, cancel it.
  timer = setTimeout(() => {
    if (running && child) {
      child.kill();
    }
  }, picture_timeout);

}
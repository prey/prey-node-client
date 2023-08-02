var join = require('path').join,
  common = require('../../../../common'),
  system = require('../../../../system'),
  run_as_user = system.run_as_logged_user,
  temp_path = system.tempfile_path,
  exec = require('child_process').exec;

const logger = common.logger.prefix('screenshot');
const appPath = join(__dirname, '..', '..', '..', 'utils', 'Prey.app');

// TODO: implment something
exports.requestPermission = () => {
  logger.info('requesting permission');
};

exports.get_screenshot = (callback) => {
  var timer,
    child,
    running = true,
    screenshot_timeout = 10000;

  var done = (err, file_path) => {
    running = false;
    if (timer) clearTimeout(timer);
    if (err) return callback(err);
    callback(null, file_path, 'image/jpeg');
  };

  if (common.osRelease < '10.15') {
    var file_path = temp_path('screenshot.' + process.pid + '.jpg');
    child = exec(
      '/usr/sbin/screencapture -t jpg -mx',
      (err) => {
        done(err, file_path);
      }
    );
  } else {
    // Patch for MacOS Catalina and future versions
    system.get_logged_user((err, user) => {
      if (err || !user) return done(new Error('Unable to find logged user'));

      exec(`id -u ${user}`, (err, user_id) => {
        user_id = user_id.toString().trim().split('\n')[0];

        let user_path = `/Users/${user}`,
          screenshot_path = join(
            user_path,
            'Library',
            'Containers',
            'com.preypatchmojave',
            'Data',
            'screenshot.jpg'
          ),
          screenshot_dir = temp_path(user_id),
          tmp_screenshot = join(
            screenshot_dir,
            'screenshot.' + process.pid + '.jpg'
          );

        // Delete previous picture if exists
        run_as_user(`rm ${screenshot_path} ${tmp_screenshot}`, [], (err) => {
          // Run webcam app
          child = run_as_user(
            `open -n ${appPath}`,
            ['--args', '-screenshot'],
            (err, out) => {
              if (err) return done(err);

              setTimeout(() => {
                // Copy the photo to /tmp dir
                run_as_user(`mkdir ${screenshot_dir}`, [], () => {
                  run_as_user(
                    `cp ${screenshot_path} ${tmp_screenshot}`,
                    [],
                    (err) => {
                      if (err)
                        return done(
                          new Error('Check your screenshot permissions.')
                        );
                      done(null, tmp_screenshot);
                    }
                  );
                });
              }, 3000);
            }
          );
        });
      });
    });
  }

  // if after 10 seconds the picture hasn't been taken, cancel it.
  timer = setTimeout(() => {
    if (running && child) {
      child.kill();
    }
  }, screenshot_timeout);
};

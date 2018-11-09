"use strict"

var join = require('path').join,
    exec = require('child_process').exec;

exports.get_picture = function(file, callback){

  var timer,
      child,
      running = true,
      picture_timeout = 10000;

  var done = (err) => {
    running = false;
    if (timer) clearTimeout(timer);
    if (err) return callback(err);
    callback(null, 'image/jpeg');
  }

  if (common.os_release < '10.14') {
    child = exec('"' + __dirname + '/imagesnap" -w 1 ' + file, function(err, stdout, stderr) {
      done(err);
    })

  } else {
    // Patch for MacOS Mojave and future versions
    common.system.get_logged_user((err, user) => {
      if (err) return callback(err);

      let user_path    = `/Users/${user}`,
          picture_path = join(user_path, 'Library', 'Containers', 'com.preypatchmojave', 'Data', 'picture.jpg'),
          app_path     = join(__dirname, '..', '..', '..', 'utils', 'Prey.app');

      // Delete previous picture if exists
      run_as_user(`rm ${picture_path}`, [], (err) => {
        // Run webcam app
        child = run_as_user(`open ${app_path}`, ['--args', '-picture'], (err, out) => {
          if (err) return done(err);
          
          setTimeout(() => {
            // Copy the photo to /tmp dir
            run_as_user(`cp ${picture_path} ${file}`, [], (err) => {
              done(err);
            })
          }, 3000)
        })
      })
    })
  }

  // if after 10 seconds the picture hasn't been taken, cancel it.
  timer = setTimeout(function() {
    if (running) {
      child.kill();
    }
  }, picture_timeout);

}
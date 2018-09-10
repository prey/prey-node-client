"use strict"

var path = require('path'),
    base_path = path.join(__dirname, '..', '..', '..'),
    notifier = require('node-notifier');

var common = require('./../common'),
    logger = common.logger.prefix('toaster');

var os_name  = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    system   = common.system,
    run_as_user = system.run_as_logged_user;

exports.notify = (opts) => {
  if (os_name == 'windows') {
    let toast_exe = path.join(base_path, 'node_modules', 'node-notifier', 'vendor', 'snoreToast', 'SnoreToast.exe');
    var options = [
      '-p', path.join(__dirname, 'prey_logo.png'),
      '-m', opts.message,
      '-t', opts.title,
      '-s', 'Notification.Default'
    ];

    run_as_user(toast_exe, options, (err, out) => {
      if (err) logger.info(err.message)
    });

  } else {
    notifier.notify({
      title: opts.title || 'Prey',
      // subtitle: 'Click here!',    
      message: opts.message,    
      icon: path.join(__dirname, 'prey_logo.png'),
      sound: true, // Only Notification Center or Windows Toasters     
      timeout: opts.timeout || 3,
      // time: 2000,
      wait: false
      }, (err, response) => {
        logger.info("error!! " + err)
    });
    
    notifier.on('click', (notifierObject, options) => {
      logger.info("CLICKED!!!") 
    });

  }
}
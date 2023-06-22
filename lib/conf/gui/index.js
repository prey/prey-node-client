var fs      = require('fs'),
    join    = require('path').join,
    spawn   = require('child_process').spawn,
    common  = require('./../../common'),
    system  = common.system,
    shared  = require('../shared'),
    osName = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

function log(str) {
  shared.log(str);
}

function run_detached(cmd, args, cb) {
  var opts = { detached: true, stdio: 'ignore' };
  var child = spawn(cmd, args, opts);
  child.unref();
  cb && cb();
};

var show_and_exit = function(force) {

  var args     = [],
      gui_path = join(__dirname, osName, 'prey-config');

  if (osName == 'windows') {
    gui_path = gui_path + '.exe';
  } else if (osName == 'linux') {
    gui_path += ((system.python_version && system.python_version >= "3.0.0") ? '3.py' : '.py');
  } else {
    args = [gui_path.replace('prey-config', 'PreyConfig.app/Contents/MacOS/prey-config.py')];
    gui_path = '/usr/bin/python';
  }

  // pass --force param to GUI app, to skip key verification check
  if (force) args = args.concat(['--force']);

  log('Firing up config GUI!');
  run_detached(gui_path, args);

  setTimeout(function(){
    // helpers.log('Exitting...');
    process.exit(0);
  }, 100); // make sure any edits to the config file are saved
}


exports.check_and_show = function(values, cb) {
  var force      = values['-f'] === true;
  var old_config = (values['-c'] || values['--check-file']) && values.positional[0];

  var show = function() {
    shared.keys.verify_current(function(err) {
      if (!err) // no error, meaning existing keys are valid
        log('Valid existing keys found. Proceeding anyway.')

      // if (!err && !force)
      //   return cb(new Error('Account already set up! Run with -f/--force to continue anyway.'));

      if (err && err.code == 'INVALID_CREDENTIALS')
        shared.keys.setApiKey(''); // clears both API and device keys

      if (err && err.code == 'INVALID_DEVICE_KEY')
        shared.keys.setDeviceKey(''); // invalid, so clear it out

      show_and_exit(force);
    })
  }

  if (!old_config || old_config == '' || !fs.existsSync(old_config))
    return show();

  // check old config file for api/device keys
  // returns error if empty or invalid
  shared.keys.retrieve_old_keys(old_config, function(err) {
    if (!err)
      log('Configuration restored from previous client!');

    show();
  });
}

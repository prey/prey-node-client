var join    = require('path').join,
    spawn   = require('child_process').spawn,
    common  = require('./../common'),
    config  = common.config,
    helpers = require('./helpers');

var os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

function run_detached(cmd, args, cb){
  var opts = { detached: true, stdio: 'ignore' };
  var child = spawn(cmd, args, opts);
  child.unref();
  cb && cb();
};

exports.show_and_exit = function(force) {

  config.writable(function(can_write) {

    if (!can_write) {
      helpers.shout('Config file not writable! Please run as system/root user.')
      return process.exit(1);
    }

    var args     = [],
        gui_path = join(__dirname, os_name, 'prey-config');

    if (os_name == 'windows')
      gui_path = gui_path + '.exe';
    else if (os_name == 'linux')
      gui_path = gui_path + '.py';
    else {
      args = [gui_path.replace('prey-config', 'PreyConfig.app/Contents/MacOS/prey-config.rb')];
      var mavericks_or_newer = parseFloat(os.release()) >= 13;
      if (mavericks_or_newer) {
        gui_path = '/System/Library/Frameworks/Ruby.framework/Versions/1.8/usr/bin/ruby';
      } else {
        gui_path = '/usr/bin/ruby';
      }
    }

    // pass --force param to GUI app, to skip key verification check
    // if (force) args = ['--force'].concat(args);

    run_detached(gui_path, args);

    process.nextTick(function(){
      helpers.log('Exitting...');
      process.exit(0);
    });
  });
}

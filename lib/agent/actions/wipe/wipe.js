var fs      = require('fs'),
    join    = require('path').join,
    async   = require('async'),
    exec    = require('child_process').exec,
    osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    os_wipe = require('./' + osName),
    common  = require('../../../common'),
    logger  = common.logger.prefix('wipejs'),
    paths   = os_wipe.paths;

require('graceful-fs');

var output      = null,
    credentials = null;

var wipe_binary = {
  path:      wipe_binary_path(),
  secure:    false,//now , secure is always false
  fill_only: false,
  keep_root : false
};

var dirs_to_wipe      = [],
    cloud_processes   = [],
    cloud_config_dirs = [];

var secure_wipe_cmd = '';
//////////////////////////////////////////////////
// paths

function wipe_binary_path() {
  var binary_name = 'wipe-' + osName.replace('windows', 'win').replace('mac', 'osx');

  return (join(__dirname, osName, binary_name));
}

function get_windows_drive() {
  return process.env.SystemDrive || 'C:';
}

var homes = {
  linux   : '/home',
  darwin  : '/Users',
  win32   : join(get_windows_drive(), 'Users')
}

if (process.platform == 'win32' && parseFloat(require('os').release()) < 6) {
  homes.win32 = join(get_windows_drive(), 'Documents and Settings')
}

//////////////////////////////////////////////////
// helpers

var write = (str) => {
  if (output)
    output.write(str + '\n');
}

//////////////////////////////////////////////////
// exports

exports.output = (stream) => {
  output = stream;
  remove.output(stream);
}

exports.documents = (cb) => {
  gather('documents', cb)
}

exports.emails = (cb) => {
  var emails = ['outlook', 'thunderbird'];
  gather('emails', () => {
    // Execute taskkill to email applications before wipping
    os_wipe.killTasks(emails, (err, out) => {
      if (err) write('Error closing email applications: ' + err.toString());
      if (osName != 'windows') return cb();
      // Delete Outlook profiles on Windows
      os_wipe.deleteOutlookProfiles((err, out) => {
        if (err) write('Error removing Outlook profile data: ' + err.toString());
        return cb();
      })
    })
  })
}

exports.passwords = (cb) => {
  gather('keychains', cb)
}

exports.cookies = (cb) => {
  var browsers = ['chrome', 'firefox', 'iexplore', 'chromium'];
  gather('browsers', () => {
    // Execute taskkill to all browsers before wipping
    os_wipe.killTasks(browsers, (err, out) => {
      if (err) write('Error closing browser applications: ' + err.toString());

      if (osName != 'windows') return cb();
      // if os is windows, do IE-specific stuff before returning
      os_wipe.clear_ie((err, out) => {
        if (err) write('Error removing IE data: ' + out.toString());
        return cb();
      })
    })
  })
}

exports.cloud = (cb) => {
  var tasks = [];
  os_wipe.tasks.clouds.forEach(app => {
    tasks = tasks.concat(app[Object.keys(app)])
  })
  os_wipe.killTasks(tasks, (err) => {
    var app_paths = [];
    os_wipe.paths.clouds.forEach(app => {
      app_paths = app_paths.concat(app[Object.keys(app)])
    })
    gather(app_paths, () => {
      gather('cloud_files', cb);
    })
  })
}

exports.directories = (cb) => {
  gather('directories', cb)
}

var wipe_opts = {
  documents  : exports.documents,
  emails     : exports.emails,
  passwords  : exports.passwords,
  cookies    : exports.cookies,
  cloud      : exports.cloud,
  directories: exports.directories
}

exports.fetch_dirs = (items, to_erase, to_kill, cred, cb) => {
  secure_wipe_cmd = wipe_binary.path
                    + (wipe_binary.secure ? ' -secure' : '')
                    + (wipe_binary.fill_only ? ' -fill_only' : '')
                    + (wipe_binary.keep_root ? ' -keep_root' : '')
                    + ' -dir '
  var array         = [];
  dirs_to_wipe      = [];
  dirs_to_wipe_keep = [];
  cloud_processes   = to_kill;
  cloud_config_dirs = to_erase;
  credentials       = (!cred || cred == null) ? null : cred;

  items.forEach((item) => {
    array.push(
      (callback) => {
        wipe_opts[item]((err) => {
          if (err) last_err = err;
          callback();
        })
      }
    )
  })

  async.series(array, (err) => {
    if (err) last_err = err;
    if (to_erase.length > 0 && to_erase[0] != '')
      dirs_to_wipe = dirs_to_wipe.concat(to_erase);

      let json_dirs = {};
      json_dirs.dirs_to_wipe =  dirs_to_wipe;
      json_dirs.dirs_to_wipe_keep =  dirs_to_wipe_keep;

    if (to_kill.length == 0 || to_kill[0] == '')  // REPENSAR
      return cb(null, json_dirs);

    os_wipe.killTasks(cloud_processes, () => {
      return cb(null, json_dirs);
    })
  });
}

exports.wipeout = (cb) => {
      var output = '';
      var cmd = secure_wipe_cmd + '"' + dirs_to_wipe.join() + '" ' + (credentials ? credentials.join(' ') : "");
      
      logger.info(cmd);
      exec(cmd, (err, stdout) => {
        if (err) last_err = err;
        output += stdout;
        cb();
      })
}

var gather = (what, cb) => {
  var dirs;
  if (Array.isArray(what)) dirs = what;
  else dirs = paths[what]

  var root  = homes[process.platform];

  if (what == 'directories') {
    paths.directories.forEach((dir) => {
      dirs_to_wipe.push(dir);
    })
    return cb();
  }
  else if(what == 'documents'){
    if (osName !== 'windows')
      secure_wipe_cmd = wipe_binary.path
                    + (wipe_binary.secure ? ' -secure' : '')
                    + (wipe_binary.fill_only ? ' -fill_only' : '')
                    + ' -keep_root'
                    + ' -dir ';
    fs.readdir(root, (err, list) => {
      if (err) return cb(err);

      list.forEach((user) => {
        dirs.forEach((dir) => {
          if (osName !== 'windows')
            dirs_to_wipe.push(join(root, user, dir));
          else
            dirs_to_wipe_keep.push(join(root, user, dir));
        })
      }); 
      return cb();
    });
  }
  else {
    fs.readdir(root, (err, list) => {
      if (err) return cb(err);

      list.forEach((user) => {
        dirs.forEach((dir) => {
          dirs_to_wipe.push(join(root, user, dir));
        })
      });
      return cb();
    });
  }
}
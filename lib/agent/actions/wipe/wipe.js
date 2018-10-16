var fs      = require('fs'),
    join    = require('path').join,
    async   = require('async'),
    exec    = require('child_process').exec,
    os_name = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    os_wipe = require('./' + os_name),
    paths   = os_wipe.paths;

require('graceful-fs');

var output      = null,
    credentials = null;

var wipe_binary = {
  path:      wipe_binary_path(),
  secure:    true,
  fill_only: false
};

var dirs_to_wipe      = [],
    cloud_processes   = [],
    cloud_config_dirs = [];

var secure_wipe_cmd = wipe_binary.path
                    + (wipe_binary.secure ? ' -secure' : '')
                    + (wipe_binary.fill_only ? ' -fill_only' : '')
                    + ' -dir ';

//////////////////////////////////////////////////
// paths

function wipe_binary_path() {
  var binary_name = 'wipe-' + os_name.replace('windows', 'win').replace('mac', 'osx');

  return (join(__dirname, os_name, binary_name));
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

var write = function(str) {
  if (output)
    output.write(str + '\n');
}

//////////////////////////////////////////////////
// exports

exports.output = function(stream) {
  output = stream;
  remove.output(stream);
}

exports.documents = function(cb) {
  wipe('documents', cb)
}

exports.emails = function(cb) {
  var emails = ['outlook', 'thunderbird'];
  // Execute taskkill to email applications before wipping
  os_wipe.killTasks(emails, function(err, out) {
    if (err) write('Error closing email applications: ' + err.toString());
    // Delete Outlook profiles on Windows
    os_wipe.deleteOutlookProfiles(function(err, out) {
      if (err) write('Error removing Outlook profile data: ' + err.toString());
      wipe('emails', function(err) {
        // After the profiles are deleted a new default profile is created for thunderbird
        os_wipe.createDefaultProfile('thunderbird', function(err, out) {
          if (err) write('Error creating new Thunderbird profile: ' + err.toString());
          cb();
        }) 
      })
    })  
  })
}

exports.passwords = function(cb) {
  wipe('keychains', cb)
}

exports.cookies = function(cb) {
  wipe('browsers', function(err) {
    if (os_name != 'windows')
      return cb(new Error("Unable to wipe cookies in " + os_name));
    
    var browsers = ['chrome', 'firefox', 'iexplore'];
    // Execute taskkill to all browsers before wipping
    os_wipe.killTasks(browsers, function(err, out) {
      if (err) write('Error closing email applications: ' + err.toString());
      // if os is windows, do IE-specific stuff before returning
      os_wipe.clear_ie(function(err, out) {
        if (err) write('Error removing IE data: ' + out.toString());
        // After the profiles are deleted a new default profile is created for firefox
        os_wipe.createDefaultProfile('firefox', function(err, out) {
          if (err) write('Error creating new Firefox profile: ' + err.toString());
          cb();
        })
      })  
    })
  })
}

exports.cloud = function(cb) {
  var tasks = [];
  os_wipe.tasks.clouds.forEach(app => {
    tasks = tasks.concat(app[Object.keys(app)])
  })
  os_wipe.killTasks(tasks, function(err) {
    var app_paths = [];
    os_wipe.paths.clouds.forEach(app => {
      app_paths = app_paths.concat(app[Object.keys(app)])
    })
    wipe(app_paths, () => {
      wipe('cloud_files', cb);
    })
  })
}

exports.directories = function(cb) {
  wipe('directories', cb)
}

var wipe_opts = {
  documents  : exports.documents,
  emails     : exports.emails,
  passwords  : exports.passwords,
  cookies    : exports.cookies,
  cloud      : exports.cloud,
  directories: exports.directories
}

exports.fetch_dirs = function(items, to_erase, to_kill, cb) {
  var array         = [];
  dirs_to_wipe      = [];
  cloud_processes   = to_kill;
  cloud_config_dirs = to_erase;
  credentials       = items.splice(-4);

  items.forEach(function(item) {
    array.push(
      function(callback) {
        wipe_opts[item](function(err) {
          if (err) last_err = err;
          callback();
        })
      }
    )
  })

  async.series(array, function(err) {
    if (err) last_err = err;
    dirs_to_wipe = dirs_to_wipe.concat(to_erase);
    os_wipe.killTasks(cloud_processes, () => {
      return cb(null, dirs_to_wipe);
    })
  });
}

exports.wipeout = function(cb) {
  var cmd = secure_wipe_cmd + '"' + dirs_to_wipe.join(',') + '" ' + credentials.join(' ');
  exec(cmd, (err, stdout) => {
    return cb(err, stdout)
  })
}

var wipe = function(what, cb) {
  var dirs;
  if (Array.isArray(what)) dirs = what;
  else dirs = paths[what]

  var root  = homes[process.platform];

  if (what == 'directories') {
    paths.directories.forEach(function(dir) {
      dirs_to_wipe.push(dir);
    })
    return cb();
  } else {
    fs.readdir(root, function(err, list) {
      if (err) return cb(err);

      list.forEach(function(user) {
        dirs.forEach(function(dir) {
          dirs_to_wipe.push(join(root, user, dir));
        })
      });
      return cb();
    });
  }
}
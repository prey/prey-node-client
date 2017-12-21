var fs       = require('fs'),
    join     = require('path').join,
    remove   = require('remover'),
    os_name  = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    os_wipe  = require('./' + os_name),
    paths    = os_wipe.paths;

require('graceful-fs');

var output   = null,
    remover  = null;

var wipe_binary = {
  path:      wipe_binary_path(),
  secure:    true,
  fill_only: false
};

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
  wipe('emails', function(err) {
    if (os_name != 'windows')
      return cb(new Error("Unable to wipe emails in " + os_name));
    
    var emails = ['outlook', 'thunderbird'];
    // Execute taskkill to email applications before wipping
    os_wipe.killTasks(emails, function(err, out) {
      if (err) write('Error closing email applications: ' + err.toString());
      // if os is windows, delete Outlook profiles before returning
      os_wipe.deleteOutlookProfiles(function(err, out) {
        if (err) write('Error removing Outlook profile data: ' + err.toString());
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
  var folders = ['Drive', 'Dropbox', 'OneDrive'];
  os_wipe.stopCloudProcess(folders, function(err) {
    if (err) write('Error closing cloud applications, proceeding anyway')
    // Wait some time to the processes be killed
    setTimeout(function() {
      wipe('clouds', function(err) {
        if (err) write('Error deleting configuration data')
        // Get old dropbox directories like 'Dropbox (Old)'
        os_wipe.getDropboxOldDirs(homes[process.platform], function(err, out) {
          if (err) write('Error getting old extra dropbox directories')
          // Add old dropbox directories to wipe array
          if (out.length > 0) paths.cloud_files = paths.cloud_files.concat(out)
          wipe('cloud_files', cb);
        })
      })
    }, 2000)
  })
}

exports.directories = function(cb) {
  wipe('directories', cb)
}

exports.stop = function() {
  remover.stop();
}

var wipe = function(what, cb) {
  var last_err,
      dirs  = 0,
      root  = homes[process.platform];

  var done = function(err, removed) {
    if (err)
      write('Error while removing dir: ' + err.message);

    if (err && err.code != 'ENOENT') {
      last_err = err;
    }

    --dirs || cb(last_err, removed);
  }

  if (what == 'directories') {
    paths.directories.forEach(function(dir) {
      dirs++;
      remover = remove(join(dir, '*'), secure_wipe_cmd, done);
    })
  } else {
    fs.readdir(root, function(err, list) {
      if (err) return cb(err);

      list.forEach(function(user) {
        paths[what].forEach(function(dir) {
          dirs++;
          remover = remove(join(root, user, dir, '*'), secure_wipe_cmd, done)
        })
      });
    });
  }
}
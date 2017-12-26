var os   = require('os'),
    join = require('path').join,
    exec = require('child_process').exec;

var OUTLOOK_NEW = 15,
    OUTLOOK_OLD = 10;

var registryPath = {
  outlook_version: join('HKEY_CLASSES_ROOT', 'Outlook.Application', 'CurVEr'),
  profileRegistry: join('HKEY_CURRENT_USER', 'Software', 'Microsoft'),
  firefox:         join('HKEY_CLASSES_ROOT', 'FirefoxHTML', 'DefaultIcon'),
  thunderbird:     join('HKEY_CLASSES_ROOT', 'ThunderbirdEML', 'DefaultIcon')
};

var registryManager = {
  query:         function(out, cb) { exec('reg query ' + '"' + out + '"', cb) },
  add:           function(out, cb) { exec('reg add '+ '"' + out + '"', cb) },
  delete:        function(out, cb) { exec('reg delete '+ '"' + out + '"' +' /f ', cb) },
  killtask:      function(out, cb) { exec('taskkill /F ' + out , cb) },
  createProfile: function(out, cb) { exec('"' + out + '"' + ' -CreateProfile default', cb) }
};

var getOutlookVersion = function(cb) {
  registryManager.query(registryPath.outlook_version, function(err, stdout) {
    if (err) return cb(err);
    cb(err, stdout.split("\n")[2].split(".").pop());
  });
}

var getProfileRegistry = function(cb) {
  var profileReg,
      version;
  this.getOutlookVersion(function(err, out){
    if (err) return cb(err);
    version = parseInt(out);

    if (version >= OUTLOOK_NEW) {
      profileReg = join(registryPath.profileRegistry, 'Office', out + '.0', 'Outlook', 'Profiles');
    } else if (version < OUTLOOK_NEW && version >= OUTLOOK_OLD) {
      profileReg = join(registryPath.profileRegistry, 'Windows NT', 'CurrentVersion', 'Windows Messaging Subsystem', 'Profiles');
    } else {
      profileReg = join(registryPath.profileRegistry, 'Windows Messaging Subsystem', 'Profiles');
    }
    cb(err, profileReg);
  });
}

var getSoftwareDir = function(softwareName, cb) {
  registryManager.query(registryPath[softwareName], function(err, stdout) {
    if (err) return cb(err);
    cb(err, stdout.split("    ")[3].split(",")[0]);
  });
}

if (parseFloat(os.release()) > 5.2) {
  var data_path = join('AppData', 'Local');
  var data_path_roaming = join('AppData', 'Roaming');
  var documents_path = ['Contacts', 'Documents', 'Downloads', 'Desktop', 'Pictures', 'Videos', 'Music'];
} else {
  var data_path = 'Application Data';
  var documents_path = ['Desktop', 'My Documents'];
}

exports.paths = {
  keychains: [],
  documents: documents_path,
  emails:      [
    join(data_path, 'Microsoft', 'Outlook'),
    join(data_path, 'Thunderbird', 'Profiles'),
    join(data_path_roaming, 'Microsoft', 'Outlook'),
    join(data_path_roaming, 'Thunderbird', 'Profiles')
  ],
  browsers:    [
    join(data_path, 'Google', 'Chrome'),
    join(data_path, 'Mozilla', 'Firefox', 'Profiles'),
    join(data_path_roaming, 'Mozilla', 'Firefox', 'Profiles'),
    join(data_path, 'Apple Computer', 'Safari')
  ],
  clouds:      [
    join(data_path, 'Google', 'Drive'),
    join(data_path, 'Dropbox'),
    join(data_path, 'Microsoft', 'Onedrive', 'Settings')
  ],
  cloud_files: [
    'Google Drive',
    'Dropbox',
    'OneDrive'
  ],
  directories: []
}

/*
exports.clear_ie = function(cb) {

  var what = {
    passwords: 32,
    form_data: 16,
    temp_files: 8,
    cookies:    2,
    history:    1
  }

  var last_err,
      count = Object.keys(what).length;

  var remove_ie_data = function(number) {
    exec('RunDll32.exe InetCpl.cpl,ClearMyTracksByProcess ' + number, function(err, out) {
      if (err) last_err = err;
      --count || cb(last_err);
    });
  }

  Object.keys(what).forEach(function(item) {
    console.log('Removing ' + item);
    remove_ie_data(what[item]);
  })

}*/

// 255 deletes everything, so no need to go one by one
exports.clear_ie = function(cb) {
  exec('RunDll32.exe InetCpl.cpl,ClearMyTracksByProcess 255', cb);
}

exports.deleteOutlookProfiles = function(cb) {
  getProfileRegistry(function(err, out) {
    if (err) return cb();
    registryManager.delete(out, function(err) {
      registryManager.add(out, cb);
    });
  });
}

exports.createDefaultProfile = function(softwareName, cb) {
  getSoftwareDir(softwareName, function(err, out) {
    if (err) return cb();
    registryManager.createProfile(out, cb);
  });
}

exports.killTasks = function(tasks, cb) {
  tasks.forEach(function(value, index) {
    var task = tasks[index] == 'Drive' ? 'googledrivesync' : tasks[index];
    tasks[index] = '/IM ' + task + '.exe';
  })
  tasks = tasks.join(' ');
  registryManager.killtask(tasks, cb);
}

exports.getDropboxOldDirs = function(home, cb) {
  var paths = [];
  exec('dir /b ' + home, function(err, usr) {
    if (err) return cb(null, paths);
    var users = usr.split("\r\n").slice(0, -1);

    users.forEach(function(entry, index) {
      var cmd = 'dir /AD /b ' + '"' + join(home, entry) + '"';
      exec(cmd, function (err, foldrs) {
        if (err) return cb(null, paths)
        var folders = foldrs.split("\r\n").slice(0, -1);

        folders.forEach(function(entry, index) {
          if (entry.indexOf("Dropbox (") == 0 || entry.indexOf("OneDrive -") == 0) {
            paths.push(entry);
          }
        })
        // On the last array item
        if (index == users.length -1) {
          paths = paths.filter(function(elem, index, self) {
            return index == self.indexOf(elem);
          })
          cb(null, paths)
        }
      })
    })
  })
}

exports.getProfileRegistry = getProfileRegistry;
exports.getOutlookVersion  = getOutlookVersion;
exports.getSoftwareDir     = getSoftwareDir;
exports.registryManager    = registryManager;
exports.registryPath       = registryPath;

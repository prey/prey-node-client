var os   = require('os'),
    join = require('path').join,
    exec = require('child_process').exec;

var outlook_version = join('HKEY_CLASSES_ROOT', 'Outlook.Application', 'CurVEr'),
    profileRegistry = join('HKEY_CURRENT_USER', 'Software', 'Microsoft');

var registry = {
  query: function(cb) { exec('reg query ' + '"' + outlook_version + '"', cb) },
  add: function(out, cb) { exec('reg add '+ '"' + out + '"', cb) },
  delete: function(out, cb) { exec('reg delete '+ '"' + out + '"' +' /f ', cb) }
};

var getOutlookVersion = function(cb) {
  registry.query(function(err, stdout) {
    if (err) return cb(err);
    cb(err, stdout.split("\n")[2].split(".").pop());
  });
}

var getProfileRegistry = function(cb) {
  getOutlookVersion(function(err, out){
    if (err) return cb(err);
    if (out.length == 1) {
      profileRegistry = join(profileRegistry, 'Windows Messaging Subsystem', 'Profiles');
    } else {
      if (parseInt(out) >= 15) {
        profileRegistry = join(profileRegistry, 'Office', out + '.0', 'Outlook', 'Profiles');
      } else {
        profileRegistry = join(profileRegistry, 'Windows NT', 'CurrentVersion', 'Windows Messaging Subsystem', 'Profiles');
      }
    }
    cb(err, profileRegistry);
  });
}

if (parseFloat(os.release()) > 5.2) {
  var data_path = join('AppData', 'Local');
  var data_path_roaming = join('AppData', 'Roaming');
  var documents_path = ['Contacts', 'Documents', 'Downloads', 'Desktop', 'Pictures', 'Videos'];
} else {
  var data_path = 'Application Data';
  var documents_path = ['Desktop', 'My Documents'];
}

exports.paths = {
  keychains: [],
  documents: documents_path,
  emails:    [
    join(data_path, 'Microsoft', 'Outlook'),
    join(data_path, 'Thunderbird', 'Profiles'),
    join(data_path_roaming, 'Microsoft', 'Outlook'),
    join(data_path_roaming, 'Thunderbird', 'Profiles')
  ],
  browsers:  [
    join(data_path, 'Google', 'Chrome'),
    join(data_path, 'Mozilla', 'Firefox', 'Profiles'),
    join(data_path, 'Apple Computer', 'Safari')
  ]
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
    registry.delete(out, function(err) {
      registry.add(out, cb);
    });
  });
}


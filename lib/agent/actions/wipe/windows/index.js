const os = require('os');
const { join } = require('path');
const { exec } = require('child_process');

const OUTLOOK_NEW = 15;
const OUTLOOK_OLD = 10;

const registryPath = {
  outlook_version: join('HKEY_CLASSES_ROOT', 'Outlook.Application', 'CurVEr'),
  firefox: join('HKEY_LOCAL_MACHINE', 'SOFTWARE', 'Microsoft', 'Windows', 'CurrentVersion', 'App Paths', 'firefox.exe'),
  thunderbird: join('HKEY_LOCAL_MACHINE', 'SOFTWARE', 'Microsoft', 'Windows', 'CurrentVersion', 'App Paths', 'thunderbird.exe'),
};

const registryManager = {
  query: (out, cb) => { exec(`reg query "${out}"`, cb); },
  add: (out, cb) => { exec(`reg add "${out}"`, cb); },
  delete: (out, cb) => { exec(`reg delete "${out}" /f`, cb); },
  killtask: (out, cb) => { exec(`taskkill /F ${out}`, cb); },
};

exports.getOutlookVersion = (cb) => {
  registryManager.query(registryPath.outlook_version, (err, stdout) => {
    if (err) return cb(err);
    cb(err, stdout.split('\n')[2].split('.').pop());
  });
};

exports.getUsers = (cb) => {
  registryManager.query('HKEY_USERS', (err, users) => {
    users = users.split('\r\n');
    users.shift();
    users.pop();
    users = users.map((user) => user.replace('HKEY_USERS\\', ''));
    return cb(null, users);
  });
};

const getProfileRegistry = (cb) => {
  let profileReg;
  const profilesReg = [];
  let version;

  exports.getOutlookVersion((err, out) => {
    if (err) return cb(err);

    out = out.split('\r')[0];
    version = parseInt(out);

    exports.getUsers((err, users) => {
      if (err) return cb(new Error('Unable to get registry users'));

      users.forEach((user, index) => {
        if (version >= OUTLOOK_NEW) {
          profileReg = join('HKEY_USERS', `${user}`, 'Software', 'Microsoft', 'Office', `${out}.0`, 'Outlook', 'Profiles');
        } else if (version < OUTLOOK_NEW && version >= OUTLOOK_OLD) {
          profileReg = join('HKEY_USERS', 'Software', 'Microsoft', `${user}`, 'Windows NT', 'CurrentVersion', 'Windows Messaging Subsystem', 'Profiles');
        } else {
          profileReg = join('HKEY_USERS', 'Software', 'Microsoft', `${user}`, 'Windows Messaging Subsystem', 'Profiles');
        }

        profilesReg.push(profileReg);

        if (index == users.length - 1) { return cb(err, profilesReg); }
      });
    });
  });
};

const getSoftwareDir = (softwareName, cb) => {
  registryManager.query(registryPath[softwareName], (err, stdout) => {
    if (err) return cb(err);
    cb(err, stdout.split('    ')[3].split(',')[0]);
  });
};

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
  emails: [
    join(data_path, 'Microsoft', 'Outlook'),
    join(data_path, 'Thunderbird', 'Profiles'),
    join(data_path_roaming, 'Microsoft', 'Outlook'),
    join(data_path_roaming, 'Thunderbird', 'Profiles'),
  ],
  browsers: [
    join(data_path, 'Google', 'Chrome'),
    join(data_path, 'Mozilla', 'Firefox', 'Profiles'),
    join(data_path_roaming, 'Mozilla', 'Firefox', 'Profiles'),
    join(data_path, 'Apple Computer', 'Safari'),
  ],
  clouds: [
    { 'Google Drive': [join(data_path, 'Google', 'Drive'), join(data_path, 'Google', 'DriveFS')] },
    { Dropbox: [join(data_path, 'Dropbox')] },
    { OneDrive: [join(data_path, 'Microsoft', 'Onedrive', 'Settings')] },
  ],
  cloud_files: [
    'Google Drive',
    'Dropbox',
    'OneDrive',
  ],
  directories: [],
};

exports.tasks = {
  clouds: [
    { 'Google Drive': ['googledrivesync', 'GoogleDriveFS'] },
    { Dropbox: ['Dropbox'] },
    { OneDrive: ['OneDrive'] },
  ],
};

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

} */

// 255 deletes everything, so no need to go one by one
exports.clear_ie = (cb) => {
  exec('RunDll32.exe InetCpl.cpl,ClearMyTracksByProcess 255', cb);
};

exports.deleteOutlookProfiles = (cb) => {
  getProfileRegistry((err, profiles) => {
    if (err) return cb();

    profiles.forEach((profile, index) => {
      registryManager.delete(profile, (err) => {
        if (index == profiles.length - 1) { return cb(); }
      });
    });
  });
};

exports.killTasks = (tasks, cb) => {
  if (tasks.length == 0) return cb();
  tasks.forEach((task, index) => {
    tasks[index] = `/IM ${task}.exe`;
  });
  tasks = tasks.join(' ');
  registryManager.killtask(tasks, cb);
};

exports.getDropboxOldDirs = (home, cb) => {
  let paths = [];
  exec(`dir /b ${home}`, (err, usr) => {
    if (err) return cb(null, paths);
    const users = usr.split('\r\n').slice(0, -1);

    users.forEach((entry, index) => {
      const cmd = 'dir /AD /b ' + `"${join(home, entry)}"`;
      exec(cmd, (err, foldrs) => {
        if (err) return cb(null, paths);
        const folders = foldrs.split('\r\n').slice(0, -1);

        folders.forEach((entry, index) => {
          if (entry.indexOf('Dropbox (') == 0 || entry.indexOf('OneDrive -') == 0) {
            paths.push(entry);
          }
        });
        // On the last array item
        if (index == users.length - 1) {
          paths = paths.filter((elem, index, self) => index == self.indexOf(elem));
          cb(null, paths);
        }
      });
    });
  });
};

exports.getProfileRegistry = getProfileRegistry;
exports.getSoftwareDir = getSoftwareDir;
exports.registryManager = registryManager;
exports.registryPath = registryPath;

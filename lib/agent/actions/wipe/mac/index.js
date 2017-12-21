var exec = require('child_process').exec;

exports.stopCloudProcess = function(folders, cb) {
  folders.forEach(function(value, index) {
    exec('pkill -9 ' + folders[index], cb)
  })
}

exports.getDropboxOldDirs = function(home, cb) {
  var paths = [];
  exec('find ' + home + ' -maxdepth 2 -name "Dropbox (*"', function(err, stdout) {
    if (err || !stdout) return cb(null, paths)

    stdout = stdout.split("\n").slice(0, -1);
    stdout.forEach(function(entry, index) {
      paths[index] = entry.split('/').pop()
    })
    // Delete repeated values
    paths = paths.filter(function(elem, index, self) {
      return index == self.indexOf(elem);
    })

    cb(null, paths);
  })
}

exports.paths = {
  keychains:   ['Library/Keychains', '.ssh'],
  documents:   ['Documents', 'Downloads', 'Desktop', 'Pictures', 'Videos'],
  emails:      ['Library/Thunderbird/Profiles', 'Library/Mail'],
  browsers:    [
    'Library/Safari',
    'Library/Application\ Support/Google/Chrome',
    'Library/Mozilla/Firefox/Profiles'
  ],
  clouds:      [
    'Library/Application\ Support/Google/Drive',
    '.dropbox'
  ],
  cloud_files: [
    'Google\ Drive',
    'Dropbox'
  ],
  directories: []
}
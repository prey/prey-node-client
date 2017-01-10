exports.stopCloudProcess = function(folders, cb) {
  folders.forEach(function(value, index) {
    exec('pkill -9 ' + folders[index].toLowerCase(), cb)
  })
}

exports.getDropboxOldDirs = function(home, cb) {
  var paths = [];
  exec('find ' + home + ' -maxdepth 2 -name "Dropbox*"', function(err, stdout) {
    if (err) return cb(null, paths)

    stdout = stdout.split("\n").slice(0, -1);
    stdout.forEach(function(entry, index) {
      paths[index] = entry.split('/').pop()
    })

    paths = paths.filter(function(elem, index, self) {
      return index == self.indexOf(elem);
    })

    cb(null, paths);
  })
}

exports.paths = {
  keychains: ['.gnome2/keyrings', '.ssh'],
  documents: ['Documents', 'Downloads', 'Desktop', 'Pictures', 'Videos'],
  emails:    ['.thunderbird', 'Maildir'],
  browsers:  [
    '.mozilla',
    '.config/google-chrome',
    '.config/chromium'
  ],
  clouds:      [
    '.dropbox'
  ],
  cloud_files: [
    'Dropbox'
  ]
}

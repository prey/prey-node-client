var exec = require('child_process').exec;

exports.killTasks = function(tasks, cb) {
  tasks = tasks.join(' ');
  exec('pkill -9 ' + tasks.toLowerCase(), cb)
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

exports.deleteOutlookProfiles = function(cb) {
  return cb();
}

exports.createDefaultProfile = function(softwareName, cb) {
  return cb();
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
    { 'Dropbox' : [ '.dropbox' ] }
  ],
  cloud_files: [
    'Dropbox'
  ],
  directories: []
}

exports.tasks = {
  clouds: [
    { 'Dropbox' : [ 'Dropbox' ] }
  ]
}
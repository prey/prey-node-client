var exec = require('child_process').exec;

exports.killTasks = function(tasks, cb) {
  if (tasks.length == 0) return cb();
  tasks.forEach(function(value, index) {
    var task = tasks[index] == 'outlook' ? 'Microsoft\ Outlook' : tasks[index];
    tasks[index] = task;
  })
  tasks = `"${tasks.join('" "')}"`;
  exec('pkill -9 ' + tasks, cb)
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
  emails:      [
    'Library/Thunderbird',
    'Library/Mail',
    'Library/Group\ Containers/UBF8T346G9.Office/Outlook'
  ],
  browsers:    [
    'Library/Safari',
    'Library/Application\ Support/Google/Chrome',
    'Library/Mozilla/Firefox',
    'Library/Application\ Support/Firefox'
  ],
  clouds:      [
    { 'Google Drive': [ 'Library/Application\ Support/Google/Drive', 'Library/Application\ Support/Google/DriveFS'] },
    { 'Dropbox'     : [ '.dropbox' ] }
  ],
  cloud_files: [
    'Google\ Drive',
    'Dropbox'
  ],
  directories: []
}

exports.tasks = {
  clouds: [
    { 'Google Drive': [ 'Google\ Drive', 'Backup\ and\ Sync'] },
    { 'Dropbox'     : [ 'Dropbox' ] }
  ]
}

var exec = require('child_process').exec;

exports.stopCloudProcess = function(folders, cb) {
  folders.forEach(function(value, index) {
    exec('pkill -f ' + folders[index], cb)
  })
}

exports.paths = {
  keychains: ['Library/Keychains', '.ssh'],
  documents: ['Documents', 'Downloads', 'Desktop', 'Pictures', 'Videos'],
  emails:    ['Library/Thunderbird/Profiles', 'Library/Mail'],
  browsers:  [
    'Library/Safari',
    'Library/Application\ Support/Google/Chrome',
    'Library/Mozilla/Firefox/Profiles'
  ],
  clouds:    [
  	'Library/Application\ Support/Google/Drive',
    '.dropbox'
  ],
  cloud_files: [
  	'Google\ Drive',
    'Dropbox',
    'Dropbox (Old)',
  ]
}
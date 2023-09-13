const { exec } = require('child_process');

// eslint-disable-next-line consistent-return
exports.killTasks = (tasks, cb) => {
  if (tasks.length === 0) return cb();

  let tasksArray = tasks;
  tasks.forEach((index) => {
    const task = tasksArray[index] === 'outlook' ? 'Microsoft Outlook' : tasksArray[index];
    tasksArray[index] = task;
  });
  tasksArray = `"${tasksArray.join('" "')}"`;
  exec(`pkill -9 ${tasksArray}`, cb);
};

exports.getDropboxOldDirs = (home, cb) => {
  let paths = [];
  // eslint-disable-next-line consistent-return
  exec(`find ${home} -maxdepth 2 -name "Dropbox (*"`, (err, stdout) => {
    if (err || !stdout) return cb(null, paths);

    const stdoutSplitted = stdout.split('\n').slice(0, -1);
    stdoutSplitted.forEach((entry, index) => {
      paths[index] = entry.split('/').pop();
    });
    // Delete repeated values
    paths = paths.filter((elem, index, self) => index === self.indexOf(elem));
    cb(null, paths);
  });
};

exports.paths = {
  keychains: ['Library/Keychains', '.ssh'],
  documents: ['Documents', 'Downloads', 'Desktop', 'Pictures', 'Videos'],
  emails: [
    'Library/Thunderbird',
    'Library/Mail',
    'Library/Group Containers/UBF8T346G9.Office/Outlook',
  ],
  browsers: [
    'Library/Safari',
    'Library/Application Support/Google/Chrome',
    'Library/Mozilla/Firefox',
    'Library/Application Support/Firefox',
  ],
  clouds: [
    { 'Google Drive': ['Library/Application Support/Google/Drive', 'Library/Application Support/Google/DriveFS'] },
    { Dropbox: ['.dropbox'] },
  ],
  cloud_files: [
    'Google Drive',
    'Dropbox',
  ],
  directories: [],
};

exports.tasks = {
  clouds: [
    { 'Google Drive': ['Google Drive', 'Backup and Sync'] },
    { Dropbox: ['Dropbox'] },
  ],
};

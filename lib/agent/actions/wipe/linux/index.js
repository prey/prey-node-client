const { exec } = require('child_process');

// eslint-disable-next-line consistent-return
exports.killTasks = (tasks, cb) => {
  if (tasks.length === 0) return cb();
  let cmd = '';
  // eslint-disable-next-line array-callback-return
  tasks.map((taks) => { cmd = `${cmd} pkill -9 ${taks};`; });
  exec(cmd, cb);
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
  keychains: ['.gnome2/keyrings', '.ssh'],
  documents: ['Documents', 'Downloads', 'Desktop', 'Pictures', 'Videos'],
  emails: ['.thunderbird', 'Maildir'],
  browsers: [
    '.mozilla',
    '.config/google-chrome',
    '.config/chromium',
  ],
  clouds: [
    { Dropbox: ['.dropbox'] },
  ],
  cloud_files: [
    'Dropbox',
  ],
  directories: [],
};

exports.tasks = {
  clouds: [
    { Dropbox: ['Dropbox'] },
  ],
};

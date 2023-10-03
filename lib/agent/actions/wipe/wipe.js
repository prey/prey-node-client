const fs = require('fs');
const { join } = require('path');
const { exec } = require('child_process');
const os = require('os');
const async = require('async');
const common = require('../../common');

const logger = common.logger.prefix('wipejs');

const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
// eslint-disable-next-line import/no-dynamic-require
const osWipe = require(`./${osName}`);

const { paths } = osWipe;

let dirsToWipe = [];
let cloudProcesses = [];
let dirsToWipeKeep = [];

let secureWipeCmd = '';

require('graceful-fs');

let output = null;
let credentials = null;

function wipeBinaryPath() {
  const binaryName = `wipe-${osName.replace('windows', 'win').replace('mac', 'osx')}`;

  return (join(__dirname, osName, binaryName));
}

const wipeBinary = {
  path: wipeBinaryPath(),
  secure: false, // now , secure is always false
  fillOnly: false,
  keepRoot: false,
};

exports.wipeConfiguration = (fillOnly, keepRoot, threepass) => {
  wipeBinary.fillOnly = fillOnly;
  wipeBinary.keepRoot = keepRoot;
  wipeBinary.threepass = threepass;

  secureWipeCmd = `${wipeBinary.path}`;
  if (wipeBinary.secure) secureWipeCmd += ' -secure';
  if (wipeBinary.fillOnly) secureWipeCmd += ' -fill_only';
  if (osName !== 'windows' || (osName === 'windows' && wipeBinary.keepRoot)) secureWipeCmd += ' -keep_root';
  if (wipeBinary.threepass) secureWipeCmd += ' -dod3pass';
  secureWipeCmd += ' -dir';
};

function getWindowsDrive() {
  return process.env.SystemDrive || 'C:';
}

const homes = {
  linux: '/home',
  darwin: '/Users',
  win32: join(getWindowsDrive(), 'Users'),
};

if (process.platform === 'win32' && parseFloat(os.release()) < 6) {
  homes.win32 = join(getWindowsDrive(), 'Documents and Settings');
}

const write = (str) => {
  if (output) { output.write(`${str}\n`); }
};

exports.output = (stream) => {
  output = stream;
};

// eslint-disable-next-line consistent-return
const gather = (what, cb) => {
  let dirs;
  if (Array.isArray(what)) dirs = what;
  else dirs = paths[what];

  const root = homes[process.platform];

  if (what === 'directories') {
    paths.directories.forEach((dir) => {
      dirsToWipe.push(dir);
    });
    return cb();
  }
  if (what === 'documents') {
    fs.readdir(root, (err, list) => {
      if (err) return cb(err);

      list.forEach((user) => {
        dirs.forEach((dir) => {
          if (osName !== 'windows') dirsToWipe.push(join(root, user, dir));
          else dirsToWipeKeep.push(join(root, user, dir));
        });
      });
      return cb();
    });
  } else {
    fs.readdir(root, (err, list) => {
      if (err) return cb(err);

      list.forEach((user) => {
        dirs.forEach((dir) => {
          dirsToWipe.push(join(root, user, dir));
        });
      });
      return cb();
    });
  }
};

exports.documents = (cb) => {
  gather('documents', cb);
};

exports.emails = (cb) => {
  const emails = ['outlook', 'thunderbird'];
  gather('emails', () => {
    // Execute taskkill to email applications before wipping
    // eslint-disable-next-line consistent-return
    osWipe.killTasks(emails, (err) => {
      if (err) write(`Error closing email applications: ${err.toString()}`);
      if (osName !== 'windows') return cb();
      // Delete Outlook profiles on Windows
      osWipe.deleteOutlookProfiles((errOutlook) => {
        if (errOutlook) write(`Error removing Outlook profile data: ${errOutlook.toString()}`);
        return cb();
      });
    });
  });
};

exports.passwords = (cb) => {
  gather('keychains', cb);
};

exports.cookies = (cb) => {
  const browsers = ['chrome', 'firefox', 'iexplore', 'chromium'];
  gather('browsers', () => {
    // Execute taskkill to all browsers before wipping
    // eslint-disable-next-line consistent-return
    osWipe.killTasks(browsers, (err) => {
      if (err) write(`Error closing browser applications: ${err.toString()}`);

      if (osName !== 'windows') return cb();
      // if os is windows, do IE-specific stuff before returning
      osWipe.clear_ie((errOsWipeIE, out) => {
        if (errOsWipeIE) write(`Error removing IE data: ${out.toString()}`);
        return cb();
      });
    });
  });
};

exports.cloud = (cb) => {
  let tasks = [];
  osWipe.tasks.clouds.forEach((app) => {
    tasks = tasks.concat(app[Object.keys(app)]);
  });
  osWipe.killTasks(tasks, () => {
    let appPaths = [];
    osWipe.paths.clouds.forEach((app) => {
      appPaths = appPaths.concat(app[Object.keys(app)]);
    });
    gather(appPaths, () => {
      gather('cloud_files', cb);
    });
  });
};

exports.directories = (cb) => {
  gather('directories', cb);
};

const wipeOpts = {
  documents: exports.documents,
  emails: exports.emails,
  passwords: exports.passwords,
  cookies: exports.cookies,
  cloud: exports.cloud,
  directories: exports.directories,
};

exports.fetch_dirs = (items, toErase, toKill, cred, cb) => {
  const array = [];
  dirsToWipe = [];
  dirsToWipeKeep = [];
  cloudProcesses = toKill;
  credentials = (!cred || cred == null) ? null : cred;

  items.forEach((item) => {
    array.push(
      (callback) => {
        wipeOpts[item](() => {
          callback();
        });
      },
    );
  });

  // eslint-disable-next-line consistent-return
  async.series(array, () => {
    if (toErase.length > 0 && toErase[0] !== '') { dirsToWipe = dirsToWipe.concat(toErase); }

    const jsonDirs = {};
    jsonDirs.dirsToWipe = dirsToWipe;
    jsonDirs.dirsToWipeKeep = dirsToWipeKeep;

    if (toKill.length === 0 || toKill[0] === '') { return cb(null, jsonDirs); }

    osWipe.killTasks(cloudProcesses, () => cb(null, jsonDirs));
  });
};

exports.wipeout = (cb) => {
  const cmd = `${secureWipeCmd}"${dirsToWipe.join()}" ${credentials ? credentials.join(' ') : ''}`;

  logger.info(cmd);
  exec(cmd, () => {
    cb();
  });
};

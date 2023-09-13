const fs = require('fs');
const { join } = require('path');
const os = require('os');
const async = require('async');

const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
// eslint-disable-next-line import/no-dynamic-require
const osWipe = require(`./${osName}`);
const common = require('../../common');

const logger = common.logger.prefix('wipejs');
const { paths } = osWipe;

require('graceful-fs');

let credentials = null;

const wipeBinaryPath = () => {
  const binaryName = `wipe-${osName.replace('windows', 'win').replace('mac', 'osx')}`;
  return (join(__dirname, osName, binaryName));
};

const wipeBinary = {
  path: wipeBinaryPath(),
  secure: false, // now , secure is always false
  fill_only: false,
  keep_root: false,
  dod3pass: false, // <-
};

let dirsToWipe = [];
let dirsToKeep = [];
let cloudProcesses = [];

let secureWipeCmd = '';
/// ///////////////////////////////////////////////
// paths
const getWindowsDrive = () => process.env.SystemDrive || 'C:';

const homes = {
  linux: '/home',
  darwin: '/Users',
  win32: join(getWindowsDrive(), 'Users'),
};

if (process.platform === 'win32' && parseFloat(os.release()) < 6) {
  homes.win32 = join(getWindowsDrive(), 'Documents and Settings');
}
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
    if (osName !== 'windows') {
      secureWipeCmd = `${wipeBinary.path
                    + (wipeBinary.secure ? ' -secure' : '')
                    + (wipeBinary.fill_only ? ' -fill_only' : '')
                    + (wipeBinary.dod3pass ? ' -dod3pass' : '')
      } -keep_root`
                    + ' -dir ';
    }
    fs.readdir(root, (err, list) => {
      if (err) return cb(err);

      list.forEach((user) => {
        dirs.forEach((dir) => {
          if (osName !== 'windows') dirsToWipe.push(join(root, user, dir));
          else dirsToKeep.push(join(root, user, dir));
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

/// ///////////////////////////////////////////////
// helpers

const write = (str) => logger.error(`${str}\n`);

/// ///////////////////////////////////////////////
// exports

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
      osWipe.deleteOutlookProfiles((errDelOutlook) => {
        if (errDelOutlook) write(`Error removing Outlook profile data: ${errDelOutlook.toString()}`);
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
      osWipe.clear_ie((errclearIe) => {
        if (errclearIe) write(`Error removing IE data: ${errclearIe.toString()}`);
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
  secureWipeCmd = `${wipeBinary.path
                    + (wipeBinary.secure ? ' -secure' : '')
                    + (wipeBinary.fill_only ? ' -fill_only' : '')
                    + (wipeBinary.keep_root ? ' -keep_root' : '')
                    + (wipeBinary.dod3pass ? ' -dod3pass' : '')
  } -dir `;
  const array = [];
  dirsToWipe = [];
  dirsToKeep = [];
  cloudProcesses = toKill;
  credentials = (!cred || cred == null) ? null : cred;

  items.forEach((item) => {
    array.push(
      (callback) => {
        wipeOpts[item]((err) => {
          if (err) callback();
        });
      },
    );
  });

  // eslint-disable-next-line consistent-return
  async.series(array, (err) => {
    if (err) if (toErase.length > 0 && toErase[0] !== '') { dirsToWipe = dirsToWipe.concat(toErase); }

    const jsonDirs = {};
    jsonDirs.dirsToWipe = dirsToWipe;
    jsonDirs.dirsToKeep = dirsToKeep;

    if (toKill.length === 0 || toKill[0] === '') return cb(null, jsonDirs);

    osWipe.killTasks(cloudProcesses, () => cb(null, jsonDirs));
  });
};

exports.wipeout = () => `${secureWipeCmd}"${dirsToWipe.join()}" ${credentials ? credentials.join(' ') : ''}`;

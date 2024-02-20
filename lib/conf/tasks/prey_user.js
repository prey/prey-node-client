/* eslint-disable consistent-return */
const fs = require('fs');
const { dirname } = require('path');
const { exec } = require('child_process');
const async = require('async');
const ocelot = require('ocelot');
const chownr = require('chownr');
const uidNumber = require('uid-number');
const shared = require('../shared');
const paths = require('../../system/paths');

const {
  log_file: logFile,
  package_bin: preyBin,
  install: installDir,
  current: currentDir,
  config: configDir,
} = paths;
const isWindows = process.platform === 'win32';

const preyUser = 'prey';
const uids = {};
const gids = {};

const log = (str) => {
  shared.log(str);
};

const debug = log;

function touch(file, cb) {
  fs.writeFile(file, '', cb);
}

const isSymlink = (path) => {
  try {
    return !!fs.readlinkSync(path);
  } catch (e) {
    return false;
  }
};

const createUser = (cb) => {
  debug(`Creating user ${preyUser}...`);
  exec(`${__dirname}/utils/createUser.sh ${preyUser}`, (err, out) => {
    if (out) log(out.trim());
    if (err && parseInt(err.code, 10) === 1) return cb(err);
    cb();
  });
};

const getIds = (user, groupId, cb) => {
  // if group is null, default to user name
  const group = groupId || (process.platform === 'darwin' ? 'wheel' : user);

  if (uids[user] && gids[group]) return cb(null, uids[user], gids[group]);

  debug(`Getting IDs for user ${user} and group ${group}`);
  uidNumber(user, group, (err, uid, gid) => {
    if (err) return cb(err);

    uids[user] = uid;
    gids[group] = gid;

    cb(null, uid, gid);
  });
};

function setupPermissions(cb) {
  const dirPaths = [installDir, configDir, logFile];
  debug(`Creating config dir: ${configDir}`);
  fs.mkdir(configDir, (err) => {
    if (err && err.code !== 'EEXIST') return cb(err);

    debug(`Touching log file: ${logFile}`);
    touch(logFile, (errTouch) => {
      if (errTouch) return cb(errTouch);

      // before chowning installDir, make sure the /current link points to something
      // otherwise we may get a ENOENT error when chowning
      if (isSymlink(currentDir) && !fs.existsSync(currentDir)) {
        debug('Broken symlink to /current detected. Cleaning up.');
        fs.unlinkSync(currentDir);
      }

      // eslint-disable-next-line no-shadow
      const fx = dirPaths.map((path) => ((cb) => {
        debug(`Setting permissions on ${path}`);
        getIds(preyUser, null, (_err, uid, gid) => {
          chownr(path, uid, gid, cb);
        });
      }));

      async.series(fx, cb);
    });
  });
}

const activate = (cb) => {
  debug(`Running "config activate" as ${preyUser}`);

  ocelot.exec_as(preyUser, `${preyBin} config activate`, (e, out) => {
    if (out) log(`--\n${out.trim()}\n--`);

    if (out && out.toString().match('EACCES')) {
      log(` -- This is probably because the new \`${preyUser}\` user does not have`);
      log(` -- read and exec access to the full path: ${dirname(preyBin)}`);
    }

    if (e || (out && out.toString().match(/Error!/))) return cb(e || new Error('Activation failed.'));
    cb();
  });
};

// eslint-disable-next-line consistent-return
exports.create = (cb) => {
  const fx = [];
  if (isWindows) return cb(new Error('This script is for Mac/Linux only.'));

  // ensure prey user exists
  fx.push(createUser);
  // create/chown config dir, log file and base_path (/usr/lib/prey)
  fx.push(setupPermissions);
  // create or sync config file, and symlink current version
  fx.push(activate);

  async.series(fx, cb);
};

exports.create_user = createUser;
exports.setup_permissions = setupPermissions;

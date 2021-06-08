var fs          = require('fs'),
    join        = require('path').join,
    dirname     = require('path').dirname,
    exec        = require('child_process').exec,
    async       = require('async'),
    ocelot      = require('ocelot'),
    chownr      = require('chownr'),
    uid_number  = require('uid-number');

var shared       = require('../shared'),
    paths        = require('./../../system/paths'),
    install_dir  = paths.install,      // /usr/lib/prey
    current_dir  = paths.current,      // /usr/lib/prey/current
    versions_dir = paths.versions,     // /usr/lib/prey/versions
    prey_bin     = paths.package_bin,
    log_file     = paths.log_file,
    config_dir   = paths.config,
    is_windows   = process.platform === 'win32';

var prey_user   = 'prey',
    uids = {},
    gids = {};

var debugging  = true, // process.env.DEBUG;
    debug      = debugging ? log : function() { /* noop */ };

////////////////////////////////////
// helpers

function abort(str) {
  console.log(str) || process.exit(1);
}

function log(str) {
  shared.log(str);
}

function touch(file, cb) {
  fs.writeFile(file, '', cb);
}

function is_symlink(path) {
  try {
    return !!fs.readlinkSync(path);
  } catch(e) {
    return false;
  }
}

////////////////////////////////////
// the functions themselves

function create_user(cb) {
  debug('Creating user ' + prey_user + '...');
  exec(__dirname + '/utils/create_user.sh ' + prey_user, function(err, out) {
    if (out) log(out.trim());

    // only return error if code == 1
    if (err && parseInt(err.code) == 1)
      return cb(err);

    cb();
  });
}

function get_ids(user, group, cb) {
  // if group is null, default to user name
  var group = group || (process.platform == 'darwin' ? 'wheel' : user);

  if (uids[user] && gids[group])
    return cb(null, uids[user], gids[group]);

  debug('Getting IDs for user ' + user + ' and group ' + group);
  uid_number(user, group, function(err, uid, gid) {
    if (err) return cb(err);

    uids[user]  = uid;
    gids[group] = gid;

    cb(null, uid, gid);
  })
}

function setup_permissions(cb) {
  var paths = [install_dir, config_dir, log_file];

  debug('Creating config dir: ' + config_dir);
  fs.mkdir(config_dir, function(err) {
    if (err && err.code != 'EEXIST')
      return cb(err);

    debug('Touching log file: ' + log_file);
    touch(log_file, function(err) {
      if (err) return cb(err);

      // before chowning install_dir, make sure the /current link points to something
      // otherwise we may get a ENOENT error when chowning
      if (is_symlink(current_dir) && !fs.existsSync(current_dir)) {
        debug('Broken symlink to /current detected. Cleaning up.');
        fs.unlinkSync(current_dir);
      }

      var fx = paths.map(function(path) {
        return function(cb) {
          debug('Setting permissions on ' + path);
          get_ids(prey_user, null, (err, uid, gid) => {
            chownr(path, uid, gid, cb)
          });
        }
      })

      async.series(fx, cb);
    })
  })
}

function activate(cb) {
  debug('Running "config activate" as ' + prey_user);

  ocelot.exec_as(prey_user, prey_bin + ' config activate', function(e, out, err) {
    if (out) log('--\n' + out.trim() + '\n--');

    if (out && out.toString().match('EACCES')) {
      log(' -- This is probably because the new `' + prey_user + '` user does not have');
      log(' -- read and exec access to the full path: ' + dirname(prey_bin));
    }

    if (e || (out && out.toString().match(/Error!/)))
      return cb(e || new Error('Activation failed.'));

    cb();
  });
}

exports.create = function(cb) {
  if (is_windows)
    return cb(new Error('This script is for Mac/Linux only.'))

  var fx = [];

  // ensure prey user exists
  fx.push(create_user);
  // create/chown config dir, log file and base_path (/usr/lib/prey)
  fx.push(setup_permissions);
  // create or sync config file, and symlink current version
  fx.push(activate);

  async.series(fx, cb);
}

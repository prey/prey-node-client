var fs          = require('fs'),
    join        = require('path').join,
    dirname     = require('path').dirname,
    exec        = require('child_process').exec,
    async       = require('async'),
    ocelot      = require('ocelot'),
    getuid      = require('uid-number');

var shared      = require('../shared'),
    paths       = require('./../../system/paths'),
    prey_bin    = paths.current_bin,
    log_file    = paths.log_file,
    config_dir  = paths.config,
    is_windows  = process.platform === 'win32';

// not used anymore
// if (is_windows) prey_bin += '.cmd';

var prey_user   = 'prey',
    install_dir = '/usr/lib/prey',
    npm_install_dir = '/usr/local/lib/node_modules/prey';

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

function chown(file, user, cb) {
  var group = process.platform == 'darwin' ? 'wheel' : user;
  getuid(user, group, function(err, uid, gid) {
    if (err) return cb(err);

    fs.chown(file, uid, gid, cb);
  })
}

////////////////////////////////////
// the functions themselves

function create_user(cb) {
  debug('Creating user ' + prey_user + '...');
  exec(__dirname + '/utils/create_user.sh ' + prey_user, function(err, out) {
    // only return error if code == 1
    if (err && parseInt(err.code) == 1)
      return cb(err);

    if (out) log(out.trim());
    cb();
  });
}

function setup_permissions(cb) {
  var paths = [config_dir, log_file];
  if (fs.existsSync(install_dir)) {
    paths.push(install_dir);
  }

  debug('Creating config dir: ' + config_dir);
  fs.mkdir(config_dir, function(err) {
    if (err && err.code != 'EEXIST')
      return cb(err);

    debug('Touching log file: ' + log_file);
    touch(log_file, function(err) {
      if (err) return cb(err);

      var fx = paths.map(function(path) {
        return function(cb) { chown(path, prey_user, cb) }
      })

      async.series(fx, cb);
    })
  })
}

function activate(cb) {
  debug('Running config activate.');

  ocelot.exec_as(prey_user, prey_bin + ' config activate', function(e, out, err) {
    if (out) log(out.trim());

    if (out && out.toString().match('EACCES')) {
      log(' -- This is probably because the new `' + prey_user + '` user does not have');
      log(' -- read and exec access to the full path: ' + dirname(prey_bin));
    }

    if (e || (out && out.toString().match(/error/i)))
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

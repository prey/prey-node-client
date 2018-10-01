"use strict"

var fs          = require('fs'),
    path        = require('path'),
    Emitter     = require('events').EventEmitter,
    common      = require('./../../common'),
    keys        = require('./../../plugins/control-panel/api/keys'),
    custom_dirs = require('./../../utils/custom-dirs')
    logger      = common.logger.prefix('cypher'),
    os_name     = common.os_name,
    system      = common.system;

var emitter,
    last_err,
    node_bin = path.join(system.paths.current, 'bin', 'node');

if (os_name == 'windows')
  node_bin = node_bin + '.exe';

var validateOpts = (opts) => {
  return new Promise((resolve, reject) => {

    if (!opts.mode || (opts.mode != 'encrypt' && opts.mode != 'decrypt'))
      return reject(new Error('Invalid cypher mode'));

    // Get users directory paths, then validate the rest
    var users_dirs = custom_dirs.get_users_dirs();
    if (users_dirs.length == 0) return reject(new Error('No users directories found'));

    if (!opts.extensions) return reject(new Error('No files extensions found'));
    if (opts.mode == 'decrypt') return resolve({ mode: opts.mode, dirs: '/Users/javo/Desktop/oeoe' });

    // User dirs includes custom directories
    if (opts.cypher_user_dirs && opts.cypher_directories) opts.cypher_directories = false;

    // Validate paths for the corresponding directories option
    let dirs, cloud = {};
    if (opts.cypher_directories) {
      let out    = custom_dirs.validateCustomDirs(opts.cypher_directories, true);
      dirs       = out[0];
      cloud      = out[1];

    } else if (opts.cypher_user_dirs) {
      users_dirs.forEach(user_dir => {cloud[user_dir] = custom_dirs.clouds_paths})
      dirs = users_dirs;

    } else {
      return reject(new Error('No cypher option selected'));
    }

    if (!dirs) return reject(new Error('Invalid or none directories to encrypt/decrypt'));

    // Get the paths and tasks to delete/kill
    let dirs_to_wipe = custom_dirs.collect_wipe_paths(cloud),
        tasks_to_kill = custom_dirs.get_tasks(cloud);

    return resolve({
      mode    : opts.mode,
      dirs    : dirs,
      to_kill : tasks_to_kill,
      to_erase: dirs_to_wipe,
    });
  }) 
}

exports.start = (opts, cb) => {
  var opts = opts || {};

  var spawn = (options) => {
    options.extensions = opts.extensions.replace(/\s/g, '');
    options.token = opts.token;

    let cypher_opts = [
      '-mode',       options.mode,
      '-folders',    options.dirs,
      '-extensions', options.extensions,
      '-device-key', keys.get().device.toString(),
      '-token',      options.token,
      options.to_kill,
      options.to_erase
    ];

    var args = [path.join(__dirname, 'runner.js')].concat(cypher_opts);
    system.spawn_as_admin_user(node_bin, args, (err, child) => {
      if (err) return finished(err);

      if (typeof child == 'function') {  // only for windows
        var opts = {
          token: options.token,
          key:   keys.get().device.toString(),
          options: {
            mode:       options.mode,
            dirs:       options.dirs,
            kill:       options.to_kill,
            extensions: options.extensions,
            erase:      options.to_erase
          }
        };

        child('cypher', opts, function(err) {
          if (err) last_err = new Error('Wipe command failed through service');
          finished(last_err, true);
        });

      } else {
        child.stdout.on('data', (str) => {
          var lines = str.toString().split(/\n/);
          lines.forEach((line) => {
            if (line.toString().match('Encrypting') || line.toString().match('Decrypting')) {
              logger.warn(line.trim());
            } else if (line.toString().match('Error:')) {
              logger.warn(line.trim());
            } else if (line.toString().match('Token not valid')) {
              finished("Invalid Security Token")
            }
          });
        });

        child.on('exit', (code) => {
          if (code !== 0)
            last_err = new Error('Cypher command failed.');

          finished();
        });
      }
    })
  }

  var finished = (err) => {
    logger.warn('Cypher Process finished');

    if (!emitter) return;
    emitter.emit('end', err);
  }

  if (!fs.existsSync(node_bin)) return finished(new Error('Node binary not present'));
  if (!opts.token) return finished(new Error("Security Token necessary"))

  validateOpts(opts)
  .catch(err => { finished(err); })
  .then(options => { spawn(options); })

  emitter = new Emitter;
  cb(null, emitter);
}

exports.stop = () => {
  emitter = null;
}

exports.validateOpts = validateOpts;

"use strict"

var fs        = require('fs'),
    path      = require('path'),
    Emitter   = require('events').EventEmitter,
    common    = require('./../../common'),
    keys      = require('./../../plugins/control-panel/api/keys'),
    base_path = path.join(__dirname, '..', '..'),
    providers = require(path.join(base_path, 'providers')),
    logger    = common.logger.prefix('cypher'),
    os_name   = common.os_name,
    system    = common.system,
    wipe_path = path.join(__dirname, '..', 'wipe', os_name),
    os_wipe   = require(wipe_path);

var clouds_paths = ['Dropbox', 'Google Drive', 'OneDrive'],
    filtered_user_dirs

var homes = {
      linux   : '/home',
      darwin  : '/Users',
      win32   : path.join(process.env.SystemDrive || 'C:', 'Users')
    };

var emitter,
    last_err,
    node_bin = path.join(system.paths.current, 'bin', 'node');

var filter_tasks = (tasks, paths) => {
  var array = [];
  tasks.forEach(task => {
    paths.map(x => { if (x[task]) array = array.concat(x[task]) })
  })
  return array;
}

var validateCustomDirs = (dirs) => {
  if (!dirs) return false;
  var directories = [],
      cloud = [];

  dirs = dirs.split(',');

  dirs.forEach((dir, index) => {
    dirs[index] = dir.trim();

    // Check the path format and if it's an user path
    if (path.isAbsolute(dirs[index]) && dirs[index].startsWith(homes[process.platform])) {
      let user = dirs[index].split(path.sep)[2];
      filtered_user_dirs.push(path.join(homes[process.platform], user));

      let cloud_app = null;
      clouds_paths.map(app => { if (dirs[index].includes(app)) cloud_app = app })

      // Add cloud app to the list if it's included in the path
      if (cloud_app || dirs[index].split(path.sep).length <= 3)
        cloud.push(cloud_app);

      directories.push(dirs[index]);
    } else 
      logger.info("Invalid directory path: " + dirs[index]);
  })

  if (directories.length == 0) return false;
  return [directories.join(','), cloud, filtered_user_dirs];
}

var validateOpts = (opts) => {
  return new Promise((resolve, reject) => {

    if (!opts.mode || (opts.mode != 'encrypt' && opts.mode != 'decrypt'))
      return reject(new Error('Invalid cypher mode'));

    // Get users directory paths, then validate the rest
    providers.get('users_list', (err, users) => {
      if (err) reject(new Error('Unable to get users directories'))
      
      let users_dirs = [];
      users.map(user => { users_dirs.push(path.join(homes[process.platform], user)) })
    
      if (opts.mode == 'decrypt')
        return resolve({ mode: opts.mode, dirs: users_dirs });
      
      if (!opts.extensions) return reject(new Error('No files extensions available'));
      
      if (opts.cypher_user_dirs && opts.cypher_directories) opts.cypher_directories = false;
  
      let dirs, cloud;
      if (opts.cypher_directories) {
        let out    = validateCustomDirs(opts.cypher_directories);
        dirs       = out[0];
        cloud      = out[1];
        users_dirs = out[2];
      }

      if (opts.cypher_user_dirs) {
        cloud = clouds_paths;
        filtered_user_dirs = users_dirs;
        dirs = users_dirs;
      }

      if (!dirs) return reject(new Error('Invalid or none directories to encrypt/decrypt'));

      var tasks_to_kill = filter_tasks(cloud, os_wipe.tasks.clouds),
          to_wipe       = filter_tasks(cloud, os_wipe.paths.clouds);

      var dirs_to_wipe = [];
      users_dirs.forEach(users_dir => {
        to_wipe.forEach(dir => {
          dirs_to_wipe.push(path.join(users_dir, dir)) 
        })
      }) 

      return resolve({ 
        mode: opts.mode, 
        dirs: dirs,
        to_kill: tasks_to_kill,
        to_wipe: dirs_to_wipe
      });
    });
  }) 
}

exports.start = (opts, cb) => {
  filtered_user_dirs = [];
  var opts = opts || {};

  var spawn = (options) => {
    options.extensions = opts.extensions.replace(/\s/g, '');

    let cypher_opts = [
      '--mode',       options.mode,
      '--folders',    options.dirs,
      '--extensions', options.extensions,
      '--device-key', keys.get().device.toString(),
      '--token',      opts.token,
      options.to_kill,
      options.to_wipe
    ];

    var args = [path.join(__dirname, 'runner.js')].concat(cypher_opts);
    system.spawn_as_admin_user(node_bin, args, (err, child) => {
      if (err) return finished(err);

      if (typeof child == 'function') {  // only for windows
        var opts = {
          token: opts.token,
          key:   keys.get().device.toString(),
          options: {
            mode:       options.mode,
            dirs:       options.dirs.split(','),
            kill:       options.to_kill,
            extensions: options.extensions.split(','),
            erase:      options.to_wipe
          }
        };
  
        child('cypher', opts, function(err) {
          if (err) last_err = new Error('Wipe command failed through service');
          finished(last_err, true);
        });

      } else {
        child.stdout.on('data', (str) => {
          console.log("DATA!!!", str.toString())
          var lines = str.toString().split(/\n/);
          lines.forEach((line) => {
            if (line.toString().match('Encrypting') || line.toString().match('Decrypting'))
              logger.warn(line.trim());
            if (line.toString().match('Token not valid')) {
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

  if (!fs.existsSync(node_bin)) finished(new Error('Node binary not present'));
  if (!opts.token) finished(new Error("Security Token necessary"))

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

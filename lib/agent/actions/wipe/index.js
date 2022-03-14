var fs      = require('fs'),
    path    = require('path'),
    Emitter = require('events').EventEmitter,
    wipe    = require('./wipe'),
    common  = require('./../../common'),
    gte     = common.helpers.is_greater_or_equal,
    keys    = require('./../../plugins/control-panel/api/keys'),
    join    = path.join,
    os_name = common.os_name,
    os_wipe = require('./' + os_name),
    logger  = common.logger.prefix('wipe'),
    system  = common.system,
    custom_dirs = require('./../../utils/custom-dirs');

var emitter,
    wipe_process; // for storing child instance

exports.node_bin = join(system.paths.current, 'bin', 'node');

if (common.os_name == 'windows')
  exports.node_bin = exports.node_bin + '.exe';

var validDirs = function(dirs) {
  var validated = custom_dirs.validateCustomDirs(dirs, false);
  if (!validated) return false;

  var dirs  = validated[0],
      cloud = validated[1];

  exports.cloud = custom_dirs.get_tasks(cloud);
  exports.directories = custom_dirs.collect_wipe_paths(cloud).concat(dirs.split(','));

  if (exports.directories.length == 0) return false;
  return true;
}

var valid_types = function(hash) {
  var list = [];

  // hash keys should be 'wipe_cookies', 'wipe_passwords', etc
  for (var key in hash) {
    var val = hash[key].toString().trim();
    if ((val != 'false' && val != 'off' && key.includes('wipe_')) && ( val == 'on' ||  val == 'true' || validDirs(val) )) {
      var method = key.replace('wipe_', ''); // just 'cookies'
      if (typeof wipe[method] == 'function')
        list.push(method);
    }
  }

  return list;
}

exports.start = function(id, opts, cb) {
  exports.directories = [];
  exports.cloud       = [];

  var opts    = opts || {};
  var token   = opts.token || null;
  var confirm = opts.confirm == 'ireallyknowwhatiamdoing';
  var items   = valid_types(opts);

  // if (!confirm)
  //   return cb(new Error('Invalid confirmation string.'))

  if (items.length == 0)
    return cb(new Error('Nothing to wipe!'))

  logger.warn('WIPING ' + items.join(', '));

  var last_err;
  var queued  = 0,
      removed = 0;

  // runs it within this context, unlike the spawn option
  var queue = function(error, method) {
    queued++;
    if (typeof wipe[method] == 'function') {
      wipe[method](function(err, removed) {
        if (err) last_err = err;

        removed += removed;
        --queued || finished(id, last_err);
      })
    } else return finished(id, error);
  }

  var compare_winsvc_version = (cb) => {
    var sys_win = require('./../../../system/windows');
    sys_win.get_winsvc_version((err, service_version) => {
      if (err) return cb(false);

      if (service_version && gte(service_version, "2.0.3"))
        return cb(true)
      else
        cb(false);
    })
  }

  // run it as another process, using impersonation (to avoid permission errors)
  var spawn = function() {
    var wipe_opts = [
      '-token', opts.token,
      exports.cloud.toString(),
      exports.directories.toString()
    ];

    var args = [join(__dirname, 'runner.js')].concat(items).concat(wipe_opts);
    system.spawn_as_admin_user(exports.node_bin, args, function(err, child) {
      if (err) {
        if (err.toString().includes('No logged user') && os_name == 'windows') {
          logger.warn('Not logged user found, proceding without impersonation')
          return queue(err, items);
        }
        else return finished(id, err);
      }

      if (typeof child == 'function') {  // only for windows
        os_wipe.paths.directories = exports.directories;

        wipe.fetch_dirs(items, exports.directories, exports.cloud, ['-token', token], (err, dirs) => {
          
          compare_winsvc_version((newer) => {

            var opts = {
              dirs:   dirs.dirs_to_wipe.concat(dirs.dirs_to_wipe_keep),
              token:  token,
              key:    keys.get().device.toString()
            };

            if (newer){
              opts.dirs = dirs.dirs_to_wipe;
              opts.dir_keep = dirs.dirs_to_wipe_keep;
            }

            child('wipe', opts, function(err) {
              if (err) last_err = new Error('Wipe command failed through service');
              finished(id, last_err);
            });

          })
        });

      } else {
        child.stdout.on('data', function(str) {
          var lines = str.toString().split(/\n/);
          lines.forEach(function(line) {
            if (line.toString().match('Removing directory')) {
              logger.warn(line.trim());
              removed++;
            } else if (line.toString().match('Error while removing dir')) {
              logger.warn(line.trim());
            } else if (line.trim() != '') {
              logger.debug(line.trim());
            }
          });
        })

        child.on('exit', function(code) {
          if (code !== 0)
            last_err = new Error('Wipe command failed.');

          finished(id, last_err);
        });

        wipe_process = child;
      }
    });
  }

  var finished = function(id, err, service) {
    logger.warn('Process finished! ' + (service ? '' : removed + ' dir(s) removed.'));

    if (!emitter) return;
    if (service) return emitter.emit('end', id, err);

    // if no files were removed, treat that as an error
    if (!err && removed == 0) {
      emitter.emit('end', id, new Error('No dirs were removed.'));
    } else {
      emitter.emit('end', id, err, { files_removed: removed });
    }
  }

  emitter = new Emitter;
  cb(null, emitter);
  fs.existsSync(exports.node_bin) ? spawn() : finished(id, new Error('Node binary not present'));

}

exports.stop = function(){
  if (wipe_process) // spawn method
    wipe_process.kill();

  emitter = null;
}

exports.valid_types = valid_types;
exports.directories = [];
exports.cloud = [];
var fs      = require('fs'),
    path    = require('path'),
    Emitter = require('events').EventEmitter,
    wipe    = require('./wipe'),
    common  = require('./../../common'),
    keys    = require('./../../plugins/control-panel/api/keys'),
    join    = path.join,
    os_name = common.os_name,
    os_wipe = require('./' + os_name),
    logger  = common.logger.prefix('wipe'),
    system  = common.system;

var custom_dirs = require('./../../utils/custom-dirs');

var emitter,
    wipe_process; // for storing child instance

var node_bin = join(system.paths.current, 'bin', 'node');

if (os_name == 'windows')
  node_bin = node_bin + '.exe';

var validDirs = function(dirs) {
  var out = custom_dirs.validateCustomDirs(dirs);
  if (!out) return false;

  var dirs = out[0];
  var cloud = out[1];

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

exports.start = function(opts, cb) {
  exports.directories = [];
  exports.cloud = [];
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
        --queued || finished(last_err);
      })
    } else return finished(error);
  }

  // run it as another process, using impersonation (to avoid permission errors)
  var spawn = function() {
    var wipe_opts = [
      '-device-key', keys.get().device.toString(),
      '-token',      opts.token,
      exports.cloud.toString(),
      exports.directories.toString()
    ];

    var args = [join(__dirname, 'runner.js')].concat(items).concat(wipe_opts);
    system.spawn_as_admin_user(node_bin, args, function(err, child) {
      if (err) {
        if (err.toString().includes('No logged user') && os_name == 'windows') {
          logger.warn('Not logged user found, proceding without impersonation')
          return queue(err, items);
        }
        else return finished(err);
      }

      if (typeof child == 'function') {  // only for windows
        os_wipe.paths.directories = exports.directories;

        wipe.fetch_dirs(items, function(err, dirs_to_wipe) {
          var opts = {
            dirs:  dirs_to_wipe,
            token: token,
            key:   keys.get().device.toString()
          };

          child('wipe', opts, function(err) {
            if (err) last_err = new Error('Wipe command failed through service');
            finished(last_err, true);
          });
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

          finished(last_err);
        });

        wipe_process = child;
      }
    });
  }

  var finished = function(err, service) {
    logger.warn('Process finished! ' + (service ? '' : removed + ' dir(s) removed.'));

    if (!emitter) return;
    if (service) return emitter.emit('end', err);

    // if no files were removed, treat that as an error
    if (!err && removed == 0) {
      emitter.emit('end', new Error('No dirs were removed.'));
    } else {
      emitter.emit('end', err, { files_removed: removed });
    }
  }

  emitter = new Emitter;
  cb(null, emitter);
  fs.existsSync(node_bin) ? spawn() : finished(new Error('Node binary not present'));
  if (!opts.token) return finished(new Error("Security Token necessary"))

}

exports.stop = function(){
  if (wipe_process) // spawn method
    wipe_process.kill();
  else
    wipe.stop();

  emitter = null;
}

exports.valid_types = valid_types;
exports.directories = [];
exports.cloud = [];
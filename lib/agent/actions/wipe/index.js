var path    = require('path'),
    Emitter = require('events').EventEmitter,
    wipe    = require('./wipe'),
    common  = require('./../../common'),
    join    = path.join,
    os_name = common.os_name,
    logger  = common.logger.prefix('wipe'),
    system  = common.system;

var emitter,
    wipe_process; // for storing child instance

var node_bin = join(system.paths.current, 'bin', 'node');

if (os_name == 'windows')
  node_bin = node_bin + '.exe';

var validDirs = function(dirs) {
  dirs = dirs.split(',');

  dirs.forEach(function(dir, index) {
    dirs[index] = dir.trim();
    if (path.isAbsolute(dirs[index])) {
      exports.directories.push(dirs[index]);
    } else logger.info("Invalid directory path: " + dirs[index]);
  })
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

  var opts    = opts || {};
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
    var args = [join(__dirname, 'runner.js')].concat(items).concat(exports.directories.toString());

    system.spawn_as_logged_user(node_bin, args, function(err, child) {
      if (err) {
        if (err.toString().includes('No logged user') && os_name == 'windows') {
          logger.warn('Not logged user found, proceding without impersonation')
          return queue(err, items);
        }
        else return finished(err);
      }

      child.stdout.on('data', function(str) {
        var lines = str.toString().split(/\n/);
        lines.forEach(function(line) {
          if (line.toString().match('File removed')) {
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
    });
  }

  var finished = function(err) {
    logger.warn('Process finished! ' + removed + ' files removed.');

    if (!emitter) return;

    // if no files were removed, treat that as an error
    if (!err && removed == 0) {
      emitter.emit('end', new Error('No files were removed.'));
    } else {
      emitter.emit('end', err, { files_removed: removed });
    }
  }

  emitter = new Emitter;
  cb(null, emitter);
  spawn();

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
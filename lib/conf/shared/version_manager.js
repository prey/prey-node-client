var fs     = require('fs'),
    path   = require('path'),
    rmdir  = require('rimraf'),
    log    = require('./log'),
    cp_r   = require('./../utils/cp').cp_r,
    common = require('./../../common'),
    paths  = common.system.paths;

var versions_list;

var versions = module.exports;

/**
 * @summary Returns latest version in versions dir
 */
versions.latest = function(){
  var list = this.list();
  return list[0];
}

/**
 * @summary Returns version where this is being executed
 */
versions.this = function(){
  return common.version;
}

/**
 * @summary Returns current symlinked version
 */
versions.current = function(){
  try {
    var json = require(path.join(paths.current, 'package.json'));
    return json.version;
    // return path.join(paths.install, relative_path);
  } catch(e) {
    log('No version is set as current.');
  }
}

/**
 * @summary Returns list of all versions
 */
versions.list = function(cb){
  if (versions_list) return versions_list;

  if (!paths.versions) {
    log('Version path is empty!');
    return [];
  }

  try {

    var list = fs.readdirSync(paths.versions);
    var sorted = list.sort(function(a, b){
      return parseFloat(a.replace('.', '')) < parseFloat(b.replace('.', '')) }
    );

    versions_list = sorted;
  } catch (e) {
    log(paths.versions + ' does not exist.');
  }

  return versions_list;
}

/**
 * @param   {String}    version
 * @param   {Callback}  cb
 *
 * @summary Sets the symlink to the current version
 *          provided that versions are supported.
 *          On macOS, copies binaries to create new inodes and avoid kernel signature cache issues.
 */
versions.set_current = function (version, cb) {
  if (!paths.versions)
    return cb();

  if (version == 'latest')
    version = versions.latest();
  else if (version == 'this')
    version = versions.this();

  const osName = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

  // On macOS, always perform the copy even for the same version.
  // The .pkg installer may overwrite binaries in-place (same inode),
  // which causes kernel signature cache mismatches (SIGKILL Code Signature Invalid).
  // Creating fresh inodes via copy is the only reliable fix.
  if (osName !== 'mac' && versions.current() == version) {
    var error = new Error('Version ' + version + ' is already set as current.');
    error.code = 'ALREADY_CURRENT';
    return cb(error);
  }

  var full_path = get_version_path(version);
  let exists = fs.existsSync(full_path)
  if (!exists) return cb(new Error('Path not found: ' + full_path));

  // On macOS, copy instead of symlink to create new inodes
  // This prevents kernel signature cache issues (SIGKILL Code Signature Invalid)
  if (osName === 'mac' && can_symlink()) {
    log('Using copy strategy on macOS to avoid kernel signature cache issues');

    // Copy into paths.versions (a subdirectory of paths.install) so that
    // WatchPaths does NOT trigger during the slow cp_r operation.
    // WatchPaths only monitors direct entries in paths.install, not recursively.
    var tmp_copy = path.join(paths.versions, '.tmp_current_' + process.pid);
    var old_current = paths.current + '.old_' + process.pid;

    // Copy entire directory to create new inodes for all binaries
    cp_r(full_path, tmp_copy, function(err) {
      if (err) return cb(err);

      // Swap current atomically using two renames instead of remove + rename.
      // This reduces the window where 'current' is invalid from seconds to microseconds.
      // fs.rename is atomic on POSIX for both symlinks (old versions) and directories.
      fs.rename(paths.current, old_current, function(err) {
        if (err && err.code !== 'ENOENT') {
          rmdir(tmp_copy, function() {});
          return cb(err);
        }

        fs.rename(tmp_copy, paths.current, function(err) {
          if (err) {
            // Try to restore old current before reporting error
            fs.rename(old_current, paths.current, function() {});
            rmdir(tmp_copy, function() {});
            return cb(err);
          }

          log('Successfully created new copy of version ' + version + ' with fresh inodes');

          // Clean up old current in background (don't block activation)
          remove_path(old_current, function() {});
          cb();
        });
      });
    });
  } else if (osName === 'windows') {
    // Windows: Use original method (remove then create)
    // fs.rename() doesn't work atomically on Windows for symlinks/junctions
    // Must remove existing symlink/directory before creating new one
    log('Using Windows strategy: remove then create');
    versions.unset_current(function(err){
      if (err && err.code != 'ENOENT') return cb(err);
      var symlink = can_symlink() ? fs.symlink : duplicate;
      symlink(full_path, paths.current, 'junction', cb);
    });
  } else if (can_symlink()) {
    // Linux/Unix: Use atomic symlink swap
    log('Using atomic symlink swap for Linux/Unix');
    const tmp_symlink = paths.current + '.tmp_' + process.pid;

    fs.symlink(full_path, tmp_symlink, 'junction', function(err) {
      if (err) return cb(err);

      // Atomic rename - this is POSIX atomic
      fs.rename(tmp_symlink, paths.current, function(err) {
        if (err) {
          // Cleanup tmp symlink on error
          fs.unlink(tmp_symlink, function() {});
          return cb(err);
        }
        cb();
      });
    });
  } else {
    // Fallback: no symlink support - use duplicate
    log('No symlink support, using duplicate copy');
    versions.unset_current(function(err){
      if (err && err.code != 'ENOENT') return cb(err);
      duplicate(full_path, paths.current, 'junction', cb);
    });
  }
}

/**
 * @param   {Callback}  cb
 *
 * @summary Unsets the symlink to the current version
 */
versions.unset_current = function(cb){
  if (!paths.current) return cb();
  var unlink = can_symlink() ? fs.unlink : rmdir;
  unlink(paths.current, cb);
}

/**
 * @summary Removes version
 */
versions.remove = function(version, cb){
  if (!version || version == '')
    return cb(new Error('Version not set'))

  log('Removing version ' + version + '...');
  rmdir(get_version_path(version), cb);
}

////////////////////////////////////////////////
// module private functions
////////////////////////////////////////////////

// Removes a path whether it's a symlink or a directory
function remove_path(target, cb) {
  fs.lstat(target, function(err, stat) {
    if (err) return cb(err);
    if (stat.isSymbolicLink()) {
      fs.unlink(target, cb);
    } else if (stat.isDirectory()) {
      rmdir(target, cb);
    } else {
      fs.unlink(target, cb);
    }
  });
}

function remove_current(cb) {
  remove_path(paths.current, cb);
}

function get_version_path(version) {
  return path.join(paths.versions, version);
}

function duplicate(src, dest, opts, cb) {
  log('Making duplicate copy of ' + src + ' in ' + dest);
  cp_r(src, dest, cb);
}

function can_symlink () {
  try {
    fs.symlinkSync();
    return true;
  } catch(e) {
    return e.code != 'ENOSYS';
  }
}
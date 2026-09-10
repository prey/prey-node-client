// @ts-check
var fs     = require('fs'),
    path   = require('path'),
    rmdir  = require('rimraf'),
    log    = require('./log'),
    cp_r   = require('./../utils/cp').cp_r,
    common = require('./../../common'),
    paths  = common.system.paths;

var versions_list;

var versions = /** @type {any} */ (module.exports);

/**
 * @summary Returns latest version in versions dir
 */
versions.latest = function(){
  var list = versions.list();
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
    var sorted = list.sort(/** @type {any} */ (function(a, b){
      return parseFloat(a.replace('.', '')) < parseFloat(b.replace('.', '')) }
    ));

    versions_list = sorted;
  } catch (e) {
    log(paths.versions + ' does not exist.');
  }

  return versions_list;
}

/**
 * @param   {string}                version
 * @param   {(err?: any) => void}   cb
 *
 * @summary Sets the symlink to the current version
 *          provided that versions are supported.
 */
versions.set_current = function (version, cb) {
  if (!paths.versions)
    return cb();

  if (version == 'latest')
    version = versions.latest();
  else if (version == 'this')
    version = versions.this();

  if (versions.current() == version) {
    var error = /** @type {Error & { code?: string }} */ (new Error('Version ' + version + ' is already set as current.'));
    error.code = 'ALREADY_CURRENT';
    return cb(error);
  }

  var full_path = get_version_path(version),
      symlink   = can_symlink() ? fs.symlink : duplicate;

  let exists = fs.existsSync(full_path)
  if (!exists) return cb(new Error('Path not found: ' + full_path));

  // symlink
  versions.unset_current(function(err){
    if (err && err.code != 'ENOENT') return cb(err);
    symlink(full_path, paths.current, 'junction', cb);
  });
}

/**
 * @param   {(err?: any) => void}   cb
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
  // eslint-disable-next-line camelcase -- pre-existing identifier
  versions_list = null; // invalidate cache so list()/latest() don't return a removed version
  rmdir(get_version_path(version), cb);
}

////////////////////////////////////////////////
// module private functions
////////////////////////////////////////////////

function get_version_path(version) {
  return path.join(paths.versions, version);
}

function duplicate(src, dest, opts, cb) {
  log('Making duplicate copy of ' + src + ' in ' + dest);
  cp_r(src, dest, cb);
}

function can_symlink () {
  try {
    // intentionally called with no args to probe for ENOSYS (symlink unsupported)
    /** @type {any} */ (fs.symlinkSync)();
    return true;
  } catch(e) {
    return e.code != 'ENOSYS';
  }
}
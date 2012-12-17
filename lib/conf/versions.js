var fs     = require('fs'),
    path   = require('path'),
    common = require('./../common'),
    rmdir  = require('./../utils/rmdir'),
    paths  = common.system.paths,
    versions_list;

var versions = module.exports;

var get_version_path = function(version){
  return path.join(paths.versions, version);
}

// return latest version in versions dir
versions.latest = function(){
  var list = this.list();
  return list[0];
}

// return version where this is being executed
versions.this = function(){
  return common.version;
}

// returns current symlinked version
versions.current = function(){
  try {
    var relative_path = fs.readlinkSync(paths.current);
    return relative_path.match(/(\d\.\d\.\d)/)[0];
    // return path.join(paths.install, relative_path);
  } catch(e) {
    console.log(paths.current + ' not found.');
  }
}

// return list of all versions
versions.list = function(cb){
  if (versions_list) return versions_list;

  try {

    var list = fs.readdirSync(paths.versions);
    var sorted = list.sort(function(a, b){
      return parseFloat(a.replace('.', '')) < parseFloat(b.replace('.', '')) }
    );

    versions_list = sorted;
  } catch (e) {
    console.log(paths.versions + ' does not exist.');
  }

  return versions_list;
}

versions.set_current = function(version, cb){

  if (!paths.versions)
    return cb();

  if (version == 'latest')
    version = versions.latest();
  else if (version == 'this')
    version = versions.this();

  var full_path = get_version_path(version);

  fs.exists(full_path, function(exists){
    if (!exists) return cb(new Error('Path not found: ' + full_path));

    // symlink
    fs.unlink(paths.current, function(err){
      if (err && err.code != 'ENOENT') return cb(err);

      fs.symlink(full_path, paths.current, {type: 'junction'}, function(err){
        if (err && err.code == 'ENOSYS') // XP or lower, not supported
          cb();
        else
          cb(err);
      })
    })
  })

}

versions.unset_current = function(cb){
  if (!paths.current)
    return cb();

  fs.unlink(paths.current, cb);
}

versions.remove = function(version, cb){
  if (!version || version == '')
    return cb(new Error('Version not set'))

  console.log('Removing version ' + version + '...');
  rmdir(get_version_path(version), cb);
}

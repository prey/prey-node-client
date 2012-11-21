var fs = require('fs'),
    common = require('./../common');

var versions = module.exports;

// return latest version in versions dir
versions.latest = function(cb){
  var list = this.list();
  var sorted = this.sort(function(a, b){ return a > b });
  return sorted[0];
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
    return versions_list = fs.readdirSync(paths.versions);
  } catch (e) {
    console.log(paths.versions + ' does not exist.');
  }
}

versions.set_current = function(version, cb){

  if (!paths.versions)
    return cb();

  if (version == 'latest')
    version = versions.latest();
  else if (version == 'this')
    version = versions.this();

  var full_path = path.join(paths.versions, version);

  fs.exists(full_path, function(exists){
    if (!exists) return cb(new Error('Path not found: ' + full_path));

    // symlink
    fs.unlink(paths.current, function(err){
      // if (err) return cb(err);

      fs.symlink(full_path, paths.current, {type: 'junction'}, cb)
    })
  })

}

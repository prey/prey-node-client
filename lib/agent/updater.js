var join    = require('path').join,
    exists  = require('fs').exists,
    common  = require('./common'),
    system  = common.system,
    child_process = require('child_process');

var update_client = function(version, cb){

  var child,
      prey_bin      = system.paths.package_bin,
      versions_path = system.paths.versions;

  var let_the_child_go = function(){
    child.unref();
    process.nextTick(function(){
      process.exit(33);
    })
  }

  var opts = {
    detached: true,
    stdio: [ 'ignore', 'pipe', 'ignore' ]
  }

  child = child_process.spawn(prey_bin, ['config', 'upgrade'], opts);

  child.stdout.on('data', function(data){
    var str = data.toString().trim();
    if (str != '' && str.match('YOUARENOTMYFATHER')) {
      let_the_child_go();
    }
  })

  child.on('exit', function(code){
    exists(join(versions_path, version), function(exists){
      return cb && cb(exists ? null : new Error('Update failed.'));
    });
  });
}

exports.check = function(cb){
  if (!system.paths.versions)
    return cb && cb(new Error('No versions support.'));

  common.package.new_version_available(common.version, function(err, version){
    if (err || !version)
      return cb && cb(err);

    update_client(version, cb);
  })
};

var join    = require('path').join,
    exists  = require('fs').exists,
    common  = require('./common'),
    system  = common.system,
    child_process = require('child_process'); // need to use child_process for stubbing to work in test

var update_client = function(version, cb){

  var child,
      out = [],
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

  child.stdout.on('data', function(data) {
    out.push(data);
    var str = data.toString().trim();

    // if the child succeeded, then it will print this in its stdout stream
    // that means it's time to let him go on his own, and complete his purpose in life.
    if (str != '' && str.match('YOUARENOTMYFATHER')) {
      let_the_child_go();
    }
  })

  child.on('exit', function(code) {
    exists(join(versions_path, version), function(exists) {
      if (exists) return cb && cb();

      var err = new Error('Update to ' + version + ' failed.');
      err.stack = out.join('\n');
      return cb && cb(err);
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

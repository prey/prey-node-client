var join    = require('path').join,
    exists  = require('fs').exists,
    common  = require('./common'),
    system  = common.system,
    spawn   = require('child_process').spawn,
    package = require(join(__dirname, '..', 'conf', 'package'));

var should_check = function(){
  return common.config.get('auto_update') === true &&
         system.paths.versions &&
         (new Date().getHours()) % 3 == 0; // don't check on every single run
}

var update_client = function(version, callback){

  var child,
      prey_bin = system.paths.package_bin,
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

  child = spawn(prey_bin, ['config', 'upgrade'], opts);

  child.stdout.on('data', function(data){
    var str = data.toString().trim();
    if (str != '' && str.match('YOUARENOTMYFATHER')) {
      let_the_child_go();
    }
  })

  child.on('exit', function(code){
    exists(join(versions_path, version), function(exists){
      return callback(exists ? null : new Error('Update failed.'));
    })
  })

}

var check = function(cb){
  if (!should_check())
    return cb();

  package.check_latest_version(function(err, version){

    if (err || !version)
      return cb(err || new Error('Unable to retrieve client version.'));

    if (!common.helpers.is_greater_than(version, common.version))
      return cb();

    update_client(version, cb);
  })

};

exports.check = check;

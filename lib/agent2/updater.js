var fs     = require('fs'),
    path   = require('path'),
    common = require('./common'),
    system = common.system,
    client = require('needle'),
    spawn  = require('child_process').spawn;

var package_name = 'prey',
    url = 'https://registry.npmjs.org/' + package_name;

var Updater = module.exports = {

  should_check: function(){
    return common.config.get('auto_update') === true &&
           system.paths.versions &&
           (new Date().getHours()) % 3 == 0; // don't check on every single run
  },

  check: function(cb){

    if (!this.should_check())
      return cb();

    var self = this;
    this.get_latest_version(function(err, version){

      if (err || !version)
        return cb(err || new Error("Unable to retrieve client version."));

      if (!common.helpers.is_greater_than(version, common.version))
        return cb();

      self.update_client(version, cb);
    })

  },

  get_latest_version: function(callback){

    client.get(url, function(err, resp, body){
      if (err) return callback(err);

      var latest_release = body['dist-tags'].latest;
      callback(null, latest_release.trim());

    });

  },

  update_client: function(version, callback){

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
      if (str != '') {
        if (data.toString().match('YOUARENOTMYFATHER')) {
          let_the_child_go();
        }
      }
    })

    child.on('exit', function(code){
      fs.exists(path.join(versions_path, version), function(exists){
        return callback(exists ? null : new Error('Update failed.'));
      })
    })

  }

}

var path = require('path'),
    exec = require('child_process').exec,
    system = require('./../../system'),
    service = {};

service.name = 'Cron Service for Prey';
service.bin  = 'PreyCronService.exe';
service.path = path.join(path.dirname(system.paths.bin_path), service.bin);

/**
 * Callback a bool if the service is installed.
 * sc qc returns error 1060 if the service is not found, so just check for an err
 * to test for existence.
 **/
service.exists = function(callback) {
  var cmd = 'sc qc prey';
  exec(cmd,function(err) {
    callback(null,!err);
  });
};

/**
 * Get the pid of the running service else null.
 **/
service.running = function(callback) {
  var cmd = 'tasklist /nh /fi "imagename eq '+service_name+'"';
  exec(cmd, function(err, stdout){
    if (err) return callback(_error("!:"+cmd,err));

    if (stdout.toString().indexOf(service_name) === -1) {
      return callback(null,null); //service not running
    }

    var cols = stdout.split(/\s+/),
    pid  = cols[2];
    callback(null,parseInt(pid));
  });
};

/**
 * Kill the running service process, note this is not the same as service_delete.
 **/
service.kill = function(pid,callback) {
  var cmd = 'taskkill /f /pid ' + pid;
  _tr('doing '+cmd);
  exec(cmd, function(err, stdout){
    if (err) return callback(_error("!:"+cmd,err));

    callback(null,stdout.indexOf("SUCCESS") !== -1);
  });
};

/**
 * Delete the service from the service registry.
 **/
service.delete = function(callback) {
  var cmd = 'sc delete prey';
  _tr('doing '+cmd);
  exec(cmd,function(err,stdout) {
    callback(null,!err);
  });
};

/**
 * Create a service, by providing the path to the executable.
 **/
service.create = function(callback) {
  get_install_path(function(err, install_path) {
      cmd = 'sc create prey binPath= '+ service.path;

      exec(cmd, function(err,stdout) {
        if(err) return callback(_error(err));

        callback(null,stdout.indexOf("SUCCESS") !== -1);
      });
    });
};

/**
 * Callback the service PID if all is well, else null.
 **/
service.start = function(callback) {
  var cmd = 'sc start prey';

  exec(cmd,function(err,stdout) {
    if(err) return callback(_error("!:"+cmd,err));

    var m = stdout.match(/PID\s+?:\s([0-9]+?)\s/);

    if (!m) return callback(null,null);

    callback(null,m[1]);
  });
};

module.exports = service;

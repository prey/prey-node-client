var join      = require('path').join,
    exec      = require('child_process').exec,
    system    = require('./../../system'),
    terminate = require('./terminate'),
    service   = {};

service.key   = 'CronService';
service.name  = 'Cron Service';
service.bin   = 'cronsvc.exe';
service.path  = '"' + join(system.paths.package, 'bin', 'windows', service.bin) + '"';

/**
 * Callback a bool if the service is installed.
 * sc qc returns error 1060 if the service is not found, so just check for an err
 * to test for existence.
 **/
service.exists = function(callback) {
  exec('sc qc ' + service.key, function(err, out) {
    var exists = !err && !out.toString().match(1060);
    callback(exists);
  });
};

/**
 * Get the pid of the running service else null.
 **/
service.running = function(callback) {
  var cmd = 'tasklist /nh /fi "imagename eq ' + service.bin + '"';

  exec(cmd, function(err, stdout){
    if (err) return callback(err);

    if (stdout.toString().indexOf(service.bin) === -1)
      return callback(); //service not running

    var cols = stdout.split(/\s+/),
        pid  = cols[2];

    callback(null, parseInt(pid));
  });
};


/**
 * Kill the running service process, note this is not the same as service_delete.
 **/
service.kill = function(cb) {
  terminate.by_name(service.bin, cb);
};


/**
 * Delete the service from the service registry.
 **/
service.delete = function(cb) {
  exec('sc delete ' + service.key, cb);
};

/**
 * Create a service, by providing the path to the executable.
 **/
service.create = function(cb) {
  var cmd = 'sc create ' + service.key + ' binPath= ' + service.path;
  cmd += ' start= auto'; // options: boot, system, auto, demand, disabled
  cmd += ' DisplayName= "' + service.name + '"';

  exec(cmd, cb);
};


/**
 * Callback the service PID if all is well, else null.
 **/
service.start = function(cb) {
  exec('sc start ' + service.key, function(err, out){
    if (out.match('PID'))
      cb();
    else
      cb(new Error(out.trim()))
  });
};

module.exports = service;

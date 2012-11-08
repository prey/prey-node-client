"use strict";

var 
  async = require('async'),
  exec = require('child_process').exec,
  service_name = "PreyCronService.exe";

/**
 * Callback a bool if the service is installed.
 * sc qc returns error 1060 if the service is not found, so just check for an err
 * to test for existence.
 **/
 var service_exists = function(callback) {
  var cmd = 'sc qc prey';
  exec(cmd,function(err) {
    callback(null,!err);
  });
};

/**
 * Get the pid of the running service else null.
 **/
 var service_running = function(callback) {
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
var service_kill = function(pid,callback) {
  var cmd = 'taskkill /f /pid ' + pid;
  console.log('doing '+cmd);
  exec(cmd, function(err, stdout){
    if (err) return callback(_error("!:"+cmd,err));

    callback(null,stdout.indexOf("SUCCESS") !== -1);
  });
};

/**
 * Delete the service from the service registry.
 **/
 var service_delete = function(callback) {
  var cmd = 'sc delete prey';
  console.log('doing '+cmd);
  exec(cmd,function(err,stdout) {
    if(err) return callback(_error(err));

    callback(null,stdout.indexOf("SUCCESS") !== -1);
  });
};

/**
 * Create a service, by providing the path to the executable. 
 **/
 var service_create = function(callback) {
  var binPath = '"'+ __dirname + '/PreyCronService.exe"',
      cmd = 'sc create prey binPath= '+binPath;

  console.log('doing '+cmd);


  exec(cmd,function(err,stdout) {
    if(err) return callback(_error(err));

    callback(null,stdout.indexOf("SUCCESS") !== -1);
  });
};

/**
 * Callback the service PID if all is well, else null.
 **/
 var service_start = function(callback) {
  var cmd = 'sc start prey';

  console.log('doing '+cmd);

  exec(cmd,function(err,stdout) {
    if(err) return callback(_error("!:"+cmd,err));

    var m = stdout.match(/PID\s+?:\s([0-9]+?)\s/);

    if (!m) return callback(null,null);

    callback(null,m[1]);
  });  
};

var remove_existing = function(callback) {
    console.log('doing remove_existing');

 async.waterfall([
    service_exists,

    // remove running instance if it exists ...
    function(exists,cb) {
      if (!exists) return cb(null,exists);

      service_running(function(err,pid) {
        if (err) return cb(err);
        if (!pid) return cb(null,exists);

        service_kill(pid,function(err,success) {
          if (err) return cb(err);
          if (!success) return cb("Can't kill service process "+pid);
          cb(null,exists);
        });
      });
    },

    // now that running instance is deleted remove service itself ...
    function(exists,cb) {
      if (!exists) cb(null);

      service_delete(function(err,success) {
        if (err) return cb(err);
        if (!success) return cb("Can't delete existing service");
        cb(null);
      });
    }
    ],
  function(err) {
    if (err) return callback(_error(err));
    callback(null);
  });
};

exports.post_install = function(callback) {
  async.waterfall([
    remove_existing,
    service_create,

    // start it, if creation successful ...
    function(success,cb) {
      if (!success) return cb('Service creation unsuccessful');

      service_start(function(err,pid) {
        if (err) return cb(err);
        cb(null,pid);
      });
    }

    ],
  function(err,pid) {
    if (err) return callback(_error(err));

    // new service should have been created and instantiated, return it's pid
    callback(null,pid);
  });
};

exports.pre_uninstall = function(callback){
	remove_existing(callback);
};



"use strict";

var async   = require('async'),
    exec    = require('child_process').exec,
    release = require('os').release(),
    join    = require('path').join,
    service = require('./service'),
    system  = require(join(__dirname, '..', '..', 'system')),
    exports = module.exports;

var remove_existing = function(cb) {

  service.exists(function(exists){
    if (!exists) return cb();

    service.kill(function(err) {
      // if (err || !success)
        // return cb(err || new Error("Can't kill process with PID " + pid));

      service.delete(cb);
    });
  })
};

var modify_firewall = function (cb) {
  var bin_path = join(system.paths.current, 'bin', 'node.exe'),
      command;

  if (parseFloat(release) >= 6.0) { // vista or higher
    command = 'netsh advfirewall firewall add rule name="Prey Agent" dir=in action=allow program="' + bin_path + '" enable=yes';
  } else {
    command = 'netsh firewall add allowedprogram "' + bin_path +'" "Prey Agent" ENABLE';
  }

  exec(command, cb);
};

exports.post_install = function(cb) {
  remove_existing(function(err){
    if (err) return cb(err);

    service.create(function(err){
      if (err)
        return cb(new Error('Unable to register service: ' + err.message));

      service.start(function(err){
        if (err)
          return cb(new Error('Unable to start service: ' + err.message));

        modify_firewall(function(err){
          console.log(arguments)

          if (err)
            return cb(new Error('Unable to modify firewall: ' + err.message));

          cb();
        });
      });
    });
  });
};

exports.pre_uninstall = function(callback){
  remove_existing(callback);
};

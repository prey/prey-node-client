"use strict";

var async   = require('async'),
    service = require('./service'),
    exports = module.exports;

var remove_existing = function(cb) {

  var remove_it = function(){
    service.delete(cb);
  }

  service.exists(function(exists){
    if (!exists) return cb();

    service.running(function(err, pid) {
      // if (err) return cb(err);

      if (!pid)
        return remove_it();

      service.kill(pid, function(err, success) {
        if (err || !success)
          return cb(err || new Error("Can't kill process with PID " + pid));

        remove_it();
      });
    });
  })
};

exports.post_install = function(cb) {
  remove_existing(function(err){
    if (err) return cb(err);

    service.create(function(err, success){
      if (err || !success)
        return cb(err || new Error('Unable to register service.'));

      service.start(cb);
    });
  });
};

exports.pre_uninstall = function(callback){
	remove_existing(callback);
};

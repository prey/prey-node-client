"use strict";

var
  async = require('async'),
  service = require('./service'),
  exports = module.exports;

var remove_existing = function(callback) {

  async.waterfall([
    service.exists,

    // remove running instance if it exists ...
    function(exists, cb) {
      if (!exists) return cb(null, exists);

      service.running(function(err, pid) {
        if (err) return cb(err);
        if (!pid) return cb(null, exists);

        service.kill(pid,function(err,success) {
          if (err) return cb(err);
          if (!success) return cb("Can't kill service with process " + pid);
          cb(null, exists);
        });
      });
    },

    // now that running instance is deleted remove service itself ...
    function(exists, cb) {
      if (!exists) cb();

      service.delete(function(err, success) {
        //if (err) return cb(err);
        if (!success)
          console.log("Can't delete existing service - maybe didn't exist");

        cb();
      });
    }
    ],
  function(err) {
    if (err) return callback(err);
    callback();
  });
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

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
    function(exists,cb) {
      if (!exists) cb(null);

      service.delete(function(err, success) {
        //if (err) return cb(err);
        if (!success)
          console.log("Can't delete existing service - maybe didn't exist");

        cb(null);
      });
    }
    ],
  function(err) {
    if (err) return callback(err);
    callback();
  });
};

exports.post_install = function(callback) {
  async.waterfall([
    remove_existing,
    service.create,
    function(success, cb) {
      if (!success)
        return cb(new Error('Service creation unsuccessful.'));

      service.start(cb);
    }], callback);
};

exports.pre_uninstall = function(callback){
	remove_existing(callback);
};

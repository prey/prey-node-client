"use strict";

var
  async = require('async'),
  service = require('./service'),
  exports = module.exports;

var remove_existing = function(callback) {
  _tr('doing remove_existing');

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
          if (!success) return cb("Can't kill service process "+pid);
          cb(null,exists);
        });
      });
    },

    // now that running instance is deleted remove service itself ...
    function(exists,cb) {
      if (!exists) cb(null);

      service.delete(function(err,success) {
        //if (err) return cb(err);
        if (!success) _tr("Can't delete existing service - maybe didn't exist");
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
    service.create,

    // start it, if creation successful ...
    function(success,cb) {
      if (!success) return cb('Service creation unsuccessful');

      service.start(function(err,pid) {
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

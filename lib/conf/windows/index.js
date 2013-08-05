"use strict";

var async     = require('async'),
    firewall = require('./firewall'),
    service = require('./service'),
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

exports.post_install = function(cb) {
  remove_existing(function(err){
    if (err) return cb(err);

    service.create(function(err){
      if (err)
        return cb(new Error('Unable to register service: ' + err.message));

      service.start(function(err){
        if (err)
          return cb(new Error('Unable to start service: ' + err.message));

        return cb();
      });
    });
  });
};

exports.pre_uninstall = function(callback){
  remove_existing(callback);
};

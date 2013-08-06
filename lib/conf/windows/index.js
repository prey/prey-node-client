"use strict";

var firewall  = require('./firewall'),
    service   = require('./service'),
    join      = require('path').join,
    system    = require(join('..', '..', 'system')),
    versions  = require(join('..', 'versions')),
    exports   = module.exports;

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
  remove_existing(function(err){
    if (err) return callback(err);

    var obj = {
      desc : 'Prey Agent',
      bin  : join(system.paths.package, 'bin', 'node.exe')
    }

    firewall.remove_rule(obj, callback);
  });
};

exports.post_activate = function(callback) {
  var obj = {
    desc : 'Prey Agent',
    bin  : join(system.paths.package, 'bin', 'node.exe')
  }

  firewall_remove_all_rules(function(){
    firewall.add_rule(obj, callback);
  });
}

function firewall_remove_all_rules (callback) {
  var list    = versions.list(),
      length  = list.length;

  list.forEach(function(ver){
    var obj = {
      desc : 'Prey Agent',
      bin  : join(system.paths.versions, ver, 'bin', 'node.exe')
    }
    firewall.remove_rule(obj, removed_rule);
  });

  function removed_rule (err) {
    length -= 1;
    if (err) console.log(err); // In case of...
    if (length === 0) return callback();
  }
}

"use strict";

var fs        = require('fs'),
    firewall  = require('./firewall'),
    service   = require('./service'),
    terminate = require('./terminate'),
    join      = require('path').join,
    common    = require(join('..', '..', 'common')),
    system    = require(join('..', '..', 'system')),
    versions  = require(join('..', 'versions')),
    exports   = module.exports;

var firewall_desc = 'Prey Agent';

var get_node_path = function(base) {
  return join(base, 'bin', 'node.exe');
};

var kill_if_running = function(cb) {
  fs.readFile(common.pid_file, function(err, str) {
    if (err) return cb && cb(err);

    terminate.by_pid(parseInt(str), cb);
  });
};

var remove_existing = function(cb) {

  service.exists(function(exists){
    if (!exists) return cb();

    service.kill(function(err) {
      // if (err || !success)
        // return cb(err || new Error("Can't kill process with PID " + pid));

      kill_if_running();
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

    remove_firewall_rules(callback);
  });
};

exports.post_activate = function(callback) {
  var obj = {
    desc : firewall_desc,
    bin  : get_node_path(system.paths.package)
  }

  remove_firewall_rules(function(){
    firewall.add_rule(obj, callback);
  });
}

function remove_firewall_rules (callback) {
  var list = versions.list();
  if (!list || !list[0]) return callback();

  var length  = list.length;

  list.forEach(function(ver){
    var obj = {
      desc : firewall_desc,
      bin  : get_node_path(join(system.paths.versions, ver))
    }
    firewall.remove_rule(obj, removed_rule);
  });

  function removed_rule (err) {
    --length || callback();
  }
}

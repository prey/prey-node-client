"use strict";

var firewall  = require('./firewall'),
    join      = require('path').join,
    paths     = require(join('..', '..', 'system/paths')),
    versions  = require(join('..', 'versions')),
    exports   = module.exports;

var firewall_desc = 'Prey Agent';

function remove_firewall_rules (cb) {
  var list = versions.list();
  if (!list || !list[0]) return cb();

  var count = list.length;

  var done = function(err) {
    --count || cb();
  }

  list.forEach(function(ver){
    var obj = {
      desc : firewall_desc,
      bin  : get_node_path(join(paths.versions, ver))
    }
    firewall.remove_rule(obj, removed_rule);
  });
}

exports.post_install = function(cb) {
  cb();
};

exports.pre_uninstall = function(cb) {
  remove_firewall_rules(cb);
};

exports.post_activate = function(cb) {
  var obj = {
    desc : firewall_desc,
    bin  : get_node_path(paths.package)
  }

  remove_firewall_rules(function() {
    firewall.add_rule(obj, cb);
  });
}

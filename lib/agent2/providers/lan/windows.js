"use strict";

var
  async = require('async'),
  exec = require('child_process').exec,
  ip_regex = require('./../network').ip_address_regex;

exports.get_active_nodes_list = function(callback) {
  var cmd = 'nbtstat -c';
  exec(cmd, function(err,stdout) {
    if (err) return callback(err);

    if (stdout.indexOf('----------') === -1)
      return callback(null,[]); // does not exist

    var table = stdout.split("\n").splice(6);

    // columns in format NAME <00> TYPE IP
    var netstatC = /([A-Z0-9]+)\s+(\S+)\s+(\S)+\s+(\S)+/;

    callback(null, table.map(function(line) {
      return line.match(netstatC);
    }).filter(function(match) {
      return match !== null;
    }).map(function(match) {
      return {
        name:match[0],
        ip_address:match[3]
      };
    }));
  });
};

/**
 *  Callsback an ip address or null if can't find the hostname
 **/
var ip_from_host = function(hostname, callback) {
  get_nodes(function(err,nodes) {
    if (err) return callback(err);

    var n = nodes.filter(function(node) {
      return node.name === hostname;
    });

    callback(null,(n.length === 1) ? n[0].ip_address : null);
  });
};

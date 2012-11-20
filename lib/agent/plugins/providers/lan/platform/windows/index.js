"use strict";

var
  async = require('async'),
  exec = require('child_process').exec;

var get_nodes = function(callback) {
  var cmd = 'nbtstat -c';
  exec(cmd,function(err,stdout) {

    if (err) return callback(_error("!:"+cmd,err));

    if (stdout.indexOf('No names in cache') !== -1)
      return callback(null,[]); // does not exist
    
    // columns in format NAME <00> TYPE IP
    var netstatC = /([A-Z0-9]+)\s+(\S+)\s+(\S)+\s+(\S)+/;

    // drop first 6 lines, takes us to address table
    var table = stdout.split("\n").splice(6);

    callback(null,table.map(function(line) {
      return line.match(netstatC);
    }).filter(function(match) {
      return match !== null ;
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
exports.get_ip_from_hostname = function(hostname, callback) {
  get_nodes(function(err,nodes) {
    if (err) return callback(_error(err));
    
    var n = nodes.filter(function(node) {
      return node.name === hostname;
    });

    callback(null,(n.length === 1) ? n[0].ip_address : null);
  });
};

/**
 * Callsback an array of nodes names.
 **/
exports.get_active_nodes_list = function(callback){
  get_nodes(callback);
};


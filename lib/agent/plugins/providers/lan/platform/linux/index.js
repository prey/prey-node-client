"use strict";

var
  network = require('./../../../network'),
  async = require('async'),
  exec = require('child_process').exec;

/**
 *
 **/
var ip_from_host = exports.get_ip_from_hostname = function(hostname, callback) {
  var cmd = 'nmblookup ' + hostname+' 2>&1' ;
  exec(cmd, function(err, stdout){
    if (err) return callback(_error("!:"+cmd,err));

    var o = stdout.trim();
    if (o.indexOf("name_query failed") !== -1)
      return callback(null,null);

    callback(null,stdout.trim());
  });
};

/**
 * Callback an array of nodes of the form {name:'',ip_address:''}.
 **/
exports.get_active_nodes_list = function(callback){
  var nodes = [];
  var skip = ['WORKGROUP', '..__MSBROWSE__.'];
  network.get_active_network_interface(function(err, nic) {
    if(err) return callback(_error(err));

    var command = 'nmblookup -A ' + nic.broadcast_address;
    exec(command, function(err, stdout) {
      if (err) return callback(_error("!:"+command,err));

      var lines = stdout.trim().toString().split("\n");
      async.parallel(lines.map(function(line) {
        var columns = line.trim().split(/\s+/);
        if(skip.indexOf(columns[0]) === -1 && columns[columns.length-1] === '<ACTIVE>') {
          return function(ascb) {
            ip_from_host(columns[0], function(ip) {
              var node = {
                name: columns[0],
                ip_address: ip
              };

              if(skip.indexOf(columns[0]) === -1) {
                _tr("Added: ",node);
                nodes.push(node);
                skip.push(node.name);
              }
              ascb();
            });
          };
        } else
          return null;
      }).filter(function(fns) { return fns !== null; }),
      function() {
        callback(null, nodes);
      });
    });
  });
};

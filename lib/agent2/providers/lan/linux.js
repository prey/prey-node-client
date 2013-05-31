"use strict";

var network = require('./../network'),
    async = require('async'),
    exec = require('child_process').exec;

/**
 *
 **/
var ip_from_host = function(hostname, callback) {

  exec('nmblookup ' + hostname+' 2>&1', function(err, stdout){
    if (err) return callback(err);

    var out = stdout.trim();
    if (out.indexOf("name_query failed") !== -1)
      return callback(new Error('Name query failed.'));

    callback(null, out);
  });

};

/**
 * Callback an array of nodes of the form {name:'',ip_address:''}.
 **/
exports.get_active_nodes_list = function(callback){

  var nodes = [], skip = ['WORKGROUP', '..__MSBROWSE__.'];

  network.get_active_network_interface(function(err, nic) {
    if (err) return callback(err);

    exec('nmblookup -A ' + nic.broadcast_address, function(err, stdout) {
      if (err) return callback(err);

      if (stdout.toString().match('No reply from'))
        return callback(new Error("Couldln't get list of devices in LAN."))

      var lines = stdout.trim().toString().split("\n");

      async.parallel(lines.map(function(line) {

        var columns = line.trim().split(/\s+/);

        if (skip.indexOf(columns[0]) === -1 && columns[columns.length-1] === '<ACTIVE>') {

          return function(ascb) {
            ip_from_host(columns[0], function(err, ip) {
              if (err) return;

              var node = {
                name: columns[0],
                ip_address: ip
              };

              if (skip.indexOf(columns[0]) === -1) {
                nodes.push(node);
                skip.push(node.name);
              }
              ascb();
            });
          };
        } else {
          return null;
        }

      }).filter(function(fns) { return fns !== null; }),

      function() {
        callback(null, nodes);
      });

    });
  });

};

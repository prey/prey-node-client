"use strict";

var
  network = _ns('network'),
  exec = require('child_process').exec;

/**
 * 
 **/
exports.get_ip_from_hostname = function(hostname, callback) {
  var cmd = 'nmblookup ' + hostname;
  exec(cmd, function(err, stdout){
    if (err) return callback(_error("!:"+cmd,err));
    
    callback(null,stdout.trim());
  });
};


/**
 * 
 **/
exports.get_active_nodes_list = function(callback){
  var nodes = [];
  var skip = ['WORKGROUP', '..__MSBROWSE__.'];
  network.get_active_network_interface(function(err, nic) {
    if(err) return callback(_error(err));

    _tr('running')
    var command = 'nmblookup -A ' + nic.broadcast_address;
    var child = exec(command, function(err, stdout, stderr) {
      if (err) return callback(_error("!:"+command,err));
      
      var lines = stdout.trim().toString().split("\n");

      _tr('lines:'+lines);
      
      lines.forEach(function(line){
        var columns = line.trim().split(/\s+/);
        if(skip.indexOf(columns[0]) === -1 && columns[columns.length-1] === '<ACTIVE>') {
          exports.get_ip_from_hostname(columns[0], function(ip){
            var node = {
              name: columns[0],
              ip_address: ip
            };
            
            if(skip.indexOf(columns[0]) === -1) {
              _tr("Added: ",node);
              nodes.push(node);
              skip.push(node.name);
            }
          });
        }
      });
    });
  });
};


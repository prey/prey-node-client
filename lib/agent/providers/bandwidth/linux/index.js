"use strict";

var
  exec = require('child_process').exec;

/**
 * 
 **/
exports.sample = function(iface,callback) {
  var command = 'cat /proc/net/dev | grep ' + iface;
  exec(command, function(err, stdout){
		if(err) return callback(_error("!:"+command,err));

    _tr('sampling ...',callback.data.sampled+' on '+iface);
		var stats = stdout.toString().trim().split(/\s+/);
		// var mtu = stats[1];
		var total_received = parseInt(stats[1]);
		var total_sent = parseInt(stats[9]);
    
    callback.data.sampled++;
    callback.data.received.push(total_received);
    callback.data.sent.push(total_sent);
    
    setTimeout(callback,1000);
    
  });
};

"use strict";

var
  async = require('async'),
  exec = require('child_process').exec;

var sampled = 0;
var max_samples = 3;
var iface = 'eth0';
var command = 'cat /proc/net/dev | grep ' + iface;
var counts = {sent: [], received: []};
var last_received, last_sent;

var parseBytes = function(bytes){
	if(bytes > 1048576)
		return (bytes/(1024*1024)).toString().substring(0,4) + " MB/s";
	else
		return (bytes/1024).toString().substring(0,5) + " KB/s";
};

var getAverage = function(direction){
	var total = 0;
	counts[direction].forEach(function(e){
		total += e;
	});
	return parseBytes(total/counts[direction].length);
};

/**
 * 
 **/
var sample = function(callback) {
  exec(command, function(err, stdout){
		if(err) return callback(_error("!:"+command,err));


    _tr('sampling ...',sampled);
		var stats = stdout.toString().trim().split(/\s+/);
		// var mtu = stats[1];
		var total_received = stats[1];
		var total_sent = stats[9];
    
		if(last_received) {

			var received = total_received - last_received;
			var sent = total_sent - last_sent;

			counts.received.push(received);
			counts.sent.push(sent);
    }
    
		last_received = total_received;
		last_sent = total_sent;

    sampled++;

    setTimeout(callback,1000);
    
  });
};

/**
 * 
 **/
exports.get_bandwidth_usage = function(callback) {
  async.whilst(function() { return sampled < max_samples; },sample,function(err) {
    if (err) return callback(_error(err));
    sampled = 0;
    callback(null, {inBytes: getAverage('received'), outBytes: getAverage('sent')});
  });
};

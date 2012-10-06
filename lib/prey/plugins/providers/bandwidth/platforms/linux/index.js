"use strict";

var exec = require('child_process').exec;

// var max_samples = 3;
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

var get_usage = exports.get_bandwidth_usage = function(callback){

	var iface = 'eth0';
  var command = 'cat /proc/net/dev | grep ' + iface;
	exec(command, function(err, stdout){
		if(err) return callback(_error("!:"+command,err));

		var stats = stdout.toString().trim().split(/\s+/);
		// var mtu = stats[1];
		var total_received = stats[1];
		var total_sent = stats[9];

		if(last_received) {

			var received = total_received - last_received;
			var sent = total_sent - last_sent;

			counts.received.push(received);
			counts.sent.push(sent);

			return callback(null, {inBytes: getAverage('received'), outBytes: getAverage('sent')});

      /*
				if(counts.received.length > max_samples){
				counts.received.shift();
				counts.sent.shift();
				}
      */
		}

		last_received = total_received;
		last_sent = total_sent;

		setTimeout(function(){
			get_usage(callback);
		}, 1000); // one second

	});

};

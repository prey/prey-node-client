//////////////////////////////////////////
// Prey Bandwidth Provider
// Written by Tomas Pollak
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		exec = require('child_process').exec,
		Getters = require('./../../../getters');

var Bandwidth = function(){

	Getters.call(this);
	var self = this;
	// this.name = 'geo';

	this.getters = [
		'bandwidth_usage'
	];

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
		return parseBytes(total/counts[direction].length)

	};

	this.get_bandwidth_usage = function(callback){

		var iface = 'eth0';
		exec('cat /proc/net/dev | grep ' + iface, function(err, stdout){

			var stats = stdout.toString().trim().split(/\s+/);
			// var mtu = stats[1];
			var total_received = stats[1];
			var total_sent = stats[9];

			if(last_received){

				var received = total_received - last_received;
				var sent = total_sent - last_sent;

				counts.received.push(received);
				counts.sent.push(sent);

				return callback(null, {in: getAverage('received'), out: getAverage('sent')});

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
				self.get_bandwidth_usage(callback);
			}, 1000); // one second

		})

	};

};

util.inherits(Bandwidth, Getters);
module.exports = new Bandwidth();

var exec = require('child_process').exec;

var average_secs = 3;
var received_counts = [], sent_counts = [];
var last_received, last_sent;

var parseBytes = function(bytes){

	if(bytes > 1048576)
		return (bytes/(1024*1024)).toString().substring(0,4) + " MB/s";
	else
		return (bytes/1024).toString().substring(0,5) + " KB/s";

};

var showAverage = function(){

	var total = 0;
	received_counts.forEach(function(e){
		total += e;
	});
	console.log("Received " + parseBytes(total/received_counts.length));


	var total = 0;
	sent_counts.forEach(function(e){
		total += e;
	});
	console.log("Sent " + parseBytes(total/sent_counts.length) + " Kb/s");

};

var getPackets = function(){

	var interface = 'eth0';
	exec('cat /proc/net/dev | grep ' + interface, function(err, stdout){

		var stats = stdout.toString().trim().split(/\s+/);
		// var mtu = stats[1];
		var total_received = stats[1];
		var total_sent = stats[9];

		if(last_received){

			var received = total_received - last_received;
			var sent = total_sent - last_sent;

			received_counts.push(received);
			sent_counts.push(sent);

			if(received_counts.length > average_secs)
				received_counts.shift();

			if(sent_counts.length > average_secs)
				sent_counts.shift();

			showAverage();

		}

		last_received = total_received;
		last_sent = total_sent;

	})
};

setInterval(getPackets, 1000);

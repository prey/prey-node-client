var exec = require('child_process').exec;

exports.get_battery_info = function(callback){
		
	var cmd = 'pmset -g batt';

	exec(cmd, function(err, stdout, stderr){
		if(err) return callback(null);

		var output = stdout.toString();

		var percentage_remaining = output.match(/(\d+)%;/)[1];
		var state = output.match(/%;\s+(\w+)/)[1];
		var time_remaining = output.match(/;\s+(\d+:\d+)/)[1];

		var data = {
			percentage_remaining: percentage_remaining,
			time_remaining: time_remaining,
			state: state
		}

		callback(data);

	});


};
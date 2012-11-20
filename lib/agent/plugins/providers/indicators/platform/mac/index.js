var exec = require('child_process').exec;



// when battery is charging, time remaining is actually
// what remains until the battery is full.
exports.get_battery_info = function(callback){

	var cmd = 'pmset -g batt';

	exec(cmd, function(err, stdout, stderr){

		if(err) return callback(err);

		var output = stdout.toString();

		var percentage_remaining = output.match(/(\d+)%;/)[1];
		var state = output.match(/%;\s+(\w+)/)[1];
		if(time_value = output.match(/;\s+(\d+:\d+)/))
			var time_remaining = time_value[1];

		var data = {
			percentage_remaining: percentage_remaining,
			time_remaining: time_remaining,
			state: state
		}

		callback(null, data);

	});


};

var exec = require('child_process').exec;

exports.get_logged_user_cmd = "stat /dev/console | cut -d' ' -f5";
exports.get_logged_user_pid_cmd = "ps ax | grep -v grep | grep loginwindow | awk '{print $1}'"

exports.get_os_version = function(callback){
	exec('sw_vers -productVersion', function(err, stdout){
		callback(err, stdout ? stdout.toString().trim() : null)
	})
}

// when battery is charging, time remaining is actually
// what remains until the battery is full.
exports.get_battery_info = function(callback){
		
	var cmd = 'pmset -g batt';

	exec(cmd, function(err, stdout, stderr){
		if(err) return callback(null);

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

		callback(data);

	});


};
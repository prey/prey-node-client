var exec = require('child_process').exec;

exports.get_battery_info = function(callback){
		
	var battery_path = '/proc/acpi/battery/BAT1';
	var remaining, full, state;

	exec('cat ' + battery_path + '/state', function(err, stdout, stderr){
		if(err) return callback(null);

		var output = stdout.toString();

		remaining = output.match(/remaining capacity:\s+(\d+)/)[1];
		state = output.match(/charging state:\s+(\w+)/)[1];

		exec('cat ' + battery_path + '/info', function(err, stdout, stderr){
			if(err) return callback(null);
			full = stdout.toString().match(/last full capacity:\s+(\d+)/)[1];

			var data = {
				remaining: parseInt(remaining),
				full: parseInt(full),
				state: state
			}

			callback(data);

		});

	});


};

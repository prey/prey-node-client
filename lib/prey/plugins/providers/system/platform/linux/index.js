var exec = require('child_process').exec;

// exports.get_logged_user_cmd = "who | cut -d' ' -f1 | tail -1";
exports.get_logged_user_cmd = "ps aux | grep ssh-agent | cut -d' ' -f1 | head -1";

exports.get_distro_name = function(callback){
	exec('lsb_release -i', function(err, stdout){
		if(err) return callback(err);
		callback(null, stdout.toString().split('\t')[1].trim())
	})
}

exports.get_os_version = function(callback){
	exec('lsb_release -r', function(err, stdout){
		if(err) return callback(err);
		callback(null, stdout.toString().split('\t')[1].trim())
	})
}

exports.get_battery_info = function(callback){

	var battery_path = '/proc/acpi/battery/BAT1';

	exec('cat ' + battery_path + '/state', function(err, stdout, stderr){

		if(err) return callback(err);

		var output = stdout.toString();

		var remaining = output.match(/remaining capacity:\s+(\d+)/)[1];
		var state = output.match(/charging state:\s+(\w+)/)[1];

		exec('cat ' + battery_path + '/info', function(err, stdout, stderr){

			if(err) return callback(err);

			var full = stdout.toString().match(/last full capacity:\s+(\d+)/)[1];

			var data = {
				percentage_remaining: parseInt(remaining) * 100 / parseInt(full),
				time_remaining: null, // TODO
				state: state
			}

			callback(null, data);

		});

	});


};

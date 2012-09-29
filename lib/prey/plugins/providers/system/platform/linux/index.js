
"use strict";

var exec = require('child_process').exec;

// exports.get_logged_user_cmd = "who | cut -d' ' -f1 | tail -1";

exports.get_logged_user = function(callback) {
  var cmd = "ps aux | grep ssh-agent | cut -d' ' -f1 | head -1";
  exec(cmd, function(err, stdout){
    if (err) return callback(_error('NO_LOGGED_USER',err));

    callback(null,stdout.toString().trim());
  });
};

exports.get_os_name = function(callback){
	exec('lsb_release -i', function(err, stdout){
		if(err) return callback(_error('OS_NAME',err));
    
    callback(null,stdout.toString().split(":")[1]);   
	});
};

exports.get_os_version = function(callback){
	exec('lsb_release -r', function(err, stdout){
		if(err) return callback(_error('OS_VERSION',err));
    
		callback(null, stdout.toString().split(':')[1].trim());
	});
};

exports.get_battery_info = function(callback){

	var battery_path = '/proc/acpi/battery/BAT0';

	exec('cat ' + battery_path + '/state', function(err, stdout){

		if(err) return callback(_error('OS_BATTERY_STATE',err));

		var output = stdout.toString();

		var remaining = output.match(/remaining capacity:\s+(\d+)/)[1];
		var state = output.match(/charging state:\s+(\w+)/)[1];

		exec('cat ' + battery_path + '/info', function(err, stdout){

			if(err) return callback(_error('OS_BATTERY_INFO',err));

			var full = stdout.toString().match(/last full capacity:\s+(\d+)/)[1];

			var data = {
				percentage_remaining: parseInt(remaining) * 100 / parseInt(full),
				time_remaining: null, // TODO
				state: state
			};

			callback(null, data);
		});
	});
};

exports.get_remaining_storage = function(callback) {
  exec("df -kh / | tail -1", function(err, stdout){
    if (err) return callback(_error('OS_REMAINING_STORAGE',err));
    
    var data = stdout.toString().trim().split(/\s+/);
    var info = {size_gb: data[1], free_gb: data[3], used: data[4] };
    callback(null, info);
  });
};

//////////////////////////////////////////
// Prey NodeJS Linux Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var script_path = require('./../../common').script_path,
		random_between = require('./../../helpers').random_between,
		exec = require('child_process').exec;

exports.temp_path = "/tmp";
exports.default_config_path = '/etc/prey';
exports.log_file_path = '/var/log/prey.log';

exports.run_as_logged_user_cmd = function(command){

	if(process.env.LOGGED_USER != process.env.RUNNING_USER)
		return "DISPLAY=:0 sudo su " + process.env.LOGGED_USER + " -c '" + command + "'";
	else
		return command;

}

exports.get_current_delay = function(callback) {

	var delay_value = null;

	exec('crontab -l', function(err, stdout, stderr){

		var lines = stdout.toString().trim().split("\n");

		lines.forEach(function(el){
			if(el.indexOf(script_path) != -1)
				delay_value = el.replace(/ \*.*/, ''); // .replace('*/', '');
		});
		
		if (!delay_value) return callback({value: null});
		
		var delay = {
			value: delay_value.replace('*/', ''),
			one_hour: delay_value.indexOf('*/') == -1 
		}

		callback(delay);

	});

};

exports.set_new_delay = function(new_delay, callback){
	
	var delay_string = new_delay == 60 ? random_between(1, 59) : "*/" + new_delay;

	var cmd = 'crontab -l | grep -v "' + script_path + '"; \
	echo "' + delay_string + " * * * * " + script_path + ' &> /dev/null" | crontab -'

	exec(cmd, callback);

}

// restarts NetworkManager so it reconnects
exports.auto_connect = function(callback){

	var cmd = "killall nm-applet &> /dev/null; nm-applet --sm-disable & 2> /dev/null"
	exec(cmd, function(err, stdout, stderr){

		if(err) callback(false);
		else callback(true);

	});

}

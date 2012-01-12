//////////////////////////////////////////
// Prey NodeJS Linux Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var script_path = require('./../../common').script_path,
		exec = require('child_process').exec;

exports.temp_path = "/tmp";
exports.default_config_path = '/etc/prey';
exports.log_file_path = '/var/log/prey.log';

exports.run_as_logged_user_cmd = function(command){

	if(process.env["USERNAME"] != process.env["LOGGED_USER"])
		return "DISPLAY=:0 sudo su " + process.env["LOGGED_USER"] + " -c '" + command + "'";
	else
		return command;

}

exports.get_current_delay = function(callback) {

	var delay_value = null;

	exec('crontab -l', function(err, stdout, stderr){

		var lines = stdout.toString().trim().split("\n");

		lines.forEach(function(el){
			if(el.indexOf(script_path) != -1)
				delay_value = el.replace(/ \*.*/, '').replace('*/', '');
		});

		callback(delay_value);

	});

};

exports.set_new_delay = function(new_delay, callback){

	// (crontab -l | grep -v prey; echo "${new_delay}" "${full_path}/prey.sh > /var/log/prey.log") | crontab -

	var cmd = 'crontab -l | grep -v "' + script_path + '"; \
	echo "*/' + new_delay + " * * * * " + script_path + ' > /var/log/prey.log 2>&1" | crontab -'

	exec(cmd, function(err, stdout, stderr){

		if(err) callback(false);
		else callback(true);

	});

}

// restarts NetworkManager so it reconnects
exports.auto_connect = function(callback){

	var cmd = "killall nm-applet &> /dev/null; nm-applet --sm-disable & 2> /dev/null"
	exec(cmd, function(err, stdout, stderr){

		if(err) callback(false);
		else callback(true);

	});

}

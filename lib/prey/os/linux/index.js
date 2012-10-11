"use strict";

//////////////////////////////////////////
// Prey Node.js Linux Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var script_path = _ns('common').script_path,
		random_between = _ns('helpers').random_between,
		exec = require('child_process').exec;

exports.temp_path = "/tmp";
exports.default_config_path = '/etc/prey';
exports.log_file_path = '/var/log/prey.log';

exports.run_as_logged_user_cmd = function(command){
	if(process.env.LOGGED_USER !== process.env.RUNNING_USER)
		return "DISPLAY=:0 sudo su " + process.env.LOGGED_USER + " -c '" + command + "'";
	else
		return command;
};

exports.process_running = function(process_name, callback){
	var cmd = 'ps ax | grep -v grep | grep -q ' + process_name + ' && echo 1';
	exec(cmd, function(err, stdout){
		callback(stdout && stdout.toString().trim() === '1');
	});
};

exports.get_current_delay = function(callback) {

	var delay_value;

	exec('crontab -l', function(err, stdout){

		if(err) return callback({value: null});
		var lines = stdout.toString().trim().split("\n");

		lines.forEach(function(el){
			if(el.indexOf(script_path) !== -1)
				delay_value = el.replace(/ \*.*/, ''); // .replace('*/', '');
		});

		if (!delay_value) return callback({value: null});

		var delay = {
			value: delay_value.replace('*/', ''),
			one_hour: delay_value.indexOf('*/') === -1
		};

		callback(delay);

	});

};

exports.set_new_delay = function(new_delay, callback){

	var delay_string = parseInt(new_delay) === 60 ? random_between(1, 59) : "*/" + new_delay;

	var cmd = 'crontab -l | grep -v "' + script_path + '"; echo "' + delay_string + " * * * * " + script_path + ' &> /dev/null" | crontab -';

	exec(cmd, callback);

};

// restarts NetworkManager so it reconnects
exports.auto_connect = function(callback){

	var cmd = "service NetworkManager restart";
	exec(cmd, callback);

};

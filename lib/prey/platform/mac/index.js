//////////////////////////////////////////
// Prey NodeJS Mac Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec = require('child_process').exec,
		script_path = require('./../../common').script_path,
		hooks = require('./../../hook_dispatcher');

exports.temp_path = '/tmp';
exports.default_config_path = '/etc/prey';
exports.log_file_path = '/var/log/prey.log';

var get_logged_user_pid = function(){
	
	var cmd = "ps aux | awk -v Var=" + process.env.LOGGED_USER + " '/loginwindow.app/ && match(Var,$1) { print $2 }'";

	exec(cmd, function(err, stdout, stderr){
		process.env.LOGGED_USER_PID = stdout.toString().trim();
		// console.log("Logged user PID is " + process.env.LOGGED_USER_PID);
	});

};

// as soon as we get the logged_user name, get the logged user pid
hooks.on('initialized', get_logged_user_pid);

exports.run_as_logged_user_cmd = function(cmd){

	if(process.env.LOGGED_USER != process.env.RUNNING_USER){
		return 'launchctl bsexec ' + process.env.LOGGED_USER_PID + ' ' + cmd;
	} else {
		return cmd;
	}

};

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

	var cmd = 'crontab -l | grep -v "' + script_path + '"; \
	echo "*/' + new_delay + " * * * * " + script_path + ' > /var/log/prey.log 2>&1" | crontab -'

	exec(cmd, function(err, stdout, stderr){

		if(err) callback(false);
		else callback(true);

	});

};

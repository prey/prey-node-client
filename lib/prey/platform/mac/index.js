//////////////////////////////////////////
// Prey NodeJS Mac Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec = require('child_process').exec,
		script_path = require('./../../common').script_path,
		random_between = require('./../../helpers').random_between;
		// hooks = require('./../../hooks');

exports.temp_path = '/tmp';
exports.default_config_path = '/etc/prey'; // /usr/local/etc/prey
exports.log_file_path = '/var/log/prey.log';

exports.get_logged_user_pid = function(){
	
	var cmd = "ps ax | grep loginwindow.app | head -1 | awk '{print $1}'";
	// var cmd = "ps aux | awk -v Var=" + process.env.LOGGED_USER + " '/loginwindow.app/ && match(Var,$1) { print $2 }'";

	exec(cmd, function(err, stdout, stderr){
		process.env.LOGGED_USER_PID = stdout.toString().trim();
		// console.log("Logged user PID is " + process.env.LOGGED_USER_PID);
	});

};

// we may need to use it right away, so let's fetch it immediately
// exports.get_logged_user_pid();

exports.run_as_logged_user_cmd = function(cmd){

	// if(process.env.LOGGED_USER != process.env.RUNNING_USER)
	//	return 'launchctl bsexec ' + process.env.LOGGED_USER_PID + ' ' + cmd;
	// else
		return cmd;

};

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

};

exports.auto_connect = function(callback){

	console.log("TODO!")
	callback();

}

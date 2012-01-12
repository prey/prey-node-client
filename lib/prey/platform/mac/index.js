//////////////////////////////////////////
// Prey NodeJS Mac Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec = require('child_process').exec,
		script_path = require('./../../common').script_path;

exports.temp_path = '/tmp';
exports.default_config_path = '/etc/prey';
exports.log_file_path = '/var/log/prey.log';

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

exports.run_as_logged_user_cmd = function(cmd){

	// TODO
	return cmd;

};

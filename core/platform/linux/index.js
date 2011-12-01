//////////////////////////////////////////
// Prey NodeJS Linux Client Specific Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('../../base'),
		util = require('util'),
		Command = require('../../command');

exports.temp_path = "/tmp";
exports.get_logged_user_cmd = "who | cut -d' ' -f1 | tail -1";

exports.current_user_cmd = function(command){

	if(process.env["USERNAME"] != process.env["LOGGED_USER"])
		return "DISPLAY=:0 sudo su " + base.logged_user + " -c '" + command + "'";
	else
		return command;

}

exports.check_current_delay = function(script_path, callback) {

	var delay_value = false;

	var cmd = new Command('crontab -l');

	cmd.on('return', function(output) {
		output.split("\n").forEach(function(el){
			if(el.indexOf(script_path) != -1){
				delay_value = el.replace(/ \*.*/, '').replace('*/', '');
				// util.debug('Found Prey record in crontab: ' + el + ". Matched delay: " + delay_value);
			}
		});
	});

};

exports.set_new_delay = function(new_delay, script_path){

	// (crontab -l | grep -v prey; echo "${new_delay}" "${full_path}/prey.sh > /var/log/prey.log") | crontab -
	var str = 'crontab -l | grep -v "' + script_path + '"; \
	echo "*/' + new_delay + " * * * * " + script_path + ' > /var/log/prey.log 2>&1" | crontab -'

	var cmd = new Command(str);

}

// restarts NetworkManager so it reconnects
exports.auto_connect = function(callback){

	var str = "killall nm-applet &> /dev/null; nm-applet --sm-disable & 2> /dev/null"
	var cmd = new Command(str);

	cmd.on('exit', function() {
		// console.log(output);
		callback();
	});

}

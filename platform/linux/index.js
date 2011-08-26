//////////////////////////////////////////
// Prey Linux Specific Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var command = require('command'), util = require('util');

exports.temp_path = "/tmp";

exports.check_current_delay = function(script_path, callback) {

	var delay_value = false;

	var cmd = command.run('crontab -l');

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

	var cmd = command.run(str);

}

// restarts NetworkManager so it reconnects
exports.auto_connect = function(){

	var str = "killall nm-applet &> /dev/null; nm-applet --sm-disable & 2> /dev/null"
	var cmd = command.run(str);

	cmd.on('return', function(output) {
		console.log(output);
	});

}

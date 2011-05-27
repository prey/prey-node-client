//////////////////////////////////////////
// Prey Evented System Command Runner
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////


var command = require('./../../lib/command'), util = require('util');

exports.check_current_delay = function(full_path, callback) {

	var delay_value = false;

	var cmd = command.run('crontab -l');

	cmd.on('return', function(output) {
		output.split("\n").forEach(function(el){
			if(el.indexOf(full_path) != -1){
				delay_value = el.replace(/ \*.*/, '').replace('*/', '');
				// util.debug('Found Prey record in crontab: ' + el + ". Matched delay: " + delay_value);
			}
		});
	});

};

exports.set_new_delay = function(new_delay, full_path){

	// (crontab -l | grep -v prey; echo "${new_delay}" "${full_path}/prey.sh > /var/log/prey.log") | crontab -
	var str = 'crontab -l | grep -v "' + full_path + '"; \
	echo "*/' + new_delay + " * * * * " + full_path + ' > /var/log/prey.log" | crontab -'

	var cmd = command.run(str);

}

// restarts NetworkManager so it reconnects
exports.auto_connect = function(){

	var command = "killall nm-applet &> /dev/null; nm-applet --sm-disable & 2> /dev/null"
	var cmd = command.run(command);

	cmd.on('return', function(output) {
		console.log(output);
	});

}

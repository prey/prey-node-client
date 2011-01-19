var system = require('./../../core/system'), util = require('util');

exports.check_current_delay = function(full_path, callback) {
	var delay_value = false;

	var cmd = new system.cmd('crontab -l');

	cmd.on('return', function(output) {
		output.split("\n").forEach(function(el){
			if(el.indexOf(full_path) != -1){
				delay_value = el.replace(/ \*.*/, '').replace('*/', '');
				util.debug('Found Prey record in crontab: ' + el + ". Matched delay: " + delay_value);
			}
		});
	});

};

exports.set_new_delay = function(new_delay, full_path){

	// (crontab -l | grep -v prey; echo "${new_delay}" "${full_path}/prey.sh > /var/log/prey.log") | crontab -
	var command = 'crontab -l | grep -v "' + full_path + '"; \
	echo "*/' + new_delay + " * * * * " + full_path + ' > /var/log/prey.log" | crontab -'

	var cmd = new system.cmd(command);

}

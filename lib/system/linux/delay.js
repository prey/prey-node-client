var bin_path = require('./../').paths.bin_path;

exports.get_current_delay = function(callback) {
	var delay_value;

	exec('crontab -l', function(err, stdout){
		if(err) return callback({value: null});
		var lines = stdout.toString().trim().split("\n");

		lines.forEach(function(el){
			if (el.indexOf(bin_path) !== -1)
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
	var delay_string = parseInt(new_delay) == 60
	    ? random_between(1, 59)
	    : "*/" + new_delay;

	var cmd = 'crontab -l | grep -v "' + bin_path + '"; \
	echo "' + delay_string + " * * * * " + bin_path + ' &> /dev/null" | crontab -'

	exec(cmd, callback);
};

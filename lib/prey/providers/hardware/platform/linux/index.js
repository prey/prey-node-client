var exec = require('child_process').exec;

exports.get_firmware_info = function(callback){

	var cmd = 'hwinfo | grep "system\\."'
	exec(cmd, function(err, stdout, stderr){

		if(err) return callback(null);
		
		var data = {};
		var lines = stdout.toString().trim().split("\n");
		lines.forEach(function(line, i){

			if(line != '') {

				// console.log(line);
				var split = line.split(" = ");

				var key = split[0].trim().replace('system.', '').replace(/\./g, '_');
				var val = split[1].replace(/'/g, '');

				data[key] = val;

			}

		});
	
		// console.log(data);
		callback(data);

	});

};

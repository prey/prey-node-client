var exec = require('child_process').exec;

// exports.get_logged_user_cmd = "echo COMPUTERSYSTEM GET USERNAME | wmic";
exports.get_logged_user_cmd = 'tasklist /FI "IMAGENAME eq explorer.exe" /FO LIST /V | find "\\"';

exports.get_os_version = function(callback){

	exec('ver', function(err, stdout, stderr){
	
		var out = stdout.toString().trim();

		if (out.indexOf('2000') != -1)
			callback('2000');
		else if(out.indexOf('XP') != -1)
			callback('XP');
		else if (out.indexOf('Vista') != -1)
			callback('Vista');
		else if (out.indexOf(' 7 ') != -1)
			callback('7');

	});
}

// when battery is charging, time remaining is actually
// what remains until the battery is full.
exports.get_battery_info = function(callback){
		
	// TODO
	callback(null);

};
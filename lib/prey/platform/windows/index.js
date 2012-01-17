//////////////////////////////////////////
// Prey NodeJS Windows Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var path = require('path'),
    exec = require('child_process').exec;

exports.temp_path = path.join(process.env.WINDIR, 'Temp');
exports.default_config_path = path.join(process.env.WINDIR, 'Prey'),
exports.log_file_path = path.join(exports.default_config_path, 'prey.log');

exports.get_current_delay = function(callback) {

	console.log("Work in progress!");
	callback();

};

exports.set_new_delay = function(new_delay, callback){

	console.log("Work in progress!");
	callback();

}

exports.auto_connect = function(callback){

	var cmd = __dirname + '/bin/autowc.exe -connect';
	exec(cmd_string, function(err, stdout, stderr){
		callback();
	});

}

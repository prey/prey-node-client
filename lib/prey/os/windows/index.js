//////////////////////////////////////////
// Prey Node.js Windows Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		path = require('path'),
    exec = require('child_process').exec;

exports.temp_path = path.join(process.env.WINDIR, 'Temp');
exports.default_config_path = path.join(process.env.WINDIR, 'Prey'),
exports.log_file_path = path.join(exports.default_config_path, 'prey.log');

exports.process_running = function(process_name, callback){
	var cmd = 'tasklist /fi "imagename eq ' + process_name + '"';
	exec(cmd, function(err, stdout, stderr){
		callback(stdout && stdout.toString().indexOf(process_name) != -1)
	});
}

exports.get_current_delay = function(callback) {
	console.log("Work in progress!");
	callback();
};

exports.set_new_delay = function(new_delay, callback){
	console.log("Work in progress!");
	callback();
}

exports.auto_connect = function(callback){
	var cmd_path = path.join(common.root_path, 'scripts', 'windows', 'autowc.exe');
	exec(cmd_path + ' -connect', callback);
}

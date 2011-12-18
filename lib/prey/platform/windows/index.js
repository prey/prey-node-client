//////////////////////////////////////////
// Prey NodeJS Windows Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var command = require('../../command'),
		util = require('util');

exports.temp_path = process.env.WINDIR + "\\Temp";
exports.default_config_path = process.env.WINDIR + "\\Prey";

exports.get_current_delay = function(callback) {

	console.log("Work in progress!");
	callback();

};

exports.set_new_delay = function(new_delay, callback){

	console.log("Work in progress!");
	callback();

}

exports.auto_connect = function(callback){

	var cmd_string = __dirname + '/bin/autowc.exe -connect';
	var cmd = new Command(cmd_string);

	cmd.on('exit', function() {
		callback();
	});


}

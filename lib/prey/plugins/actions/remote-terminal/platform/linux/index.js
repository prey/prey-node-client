//////////////////////////////////////////
// Prey JS Terminal Module Linux Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec = require('child_process').exec;

exports.ssh_server_running = function(callback){

	exec('ps aux | grep sshd > /dev/null && echo 1', function(err, stdout, stderr){

		callback(stdout && stdout.toString().trim() == '1')

	});

};

exports.start_ssh_server = function(callback){
	exec('/etc/init.d/ssh start', callback)
}

exports.stop_ssh_server = function(callback){
	exec('/etc/init.d/ssh stop', callback)
}

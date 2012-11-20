"use strict";

//////////////////////////////////////////
// Prey JS Terminal Module Mac Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec = require('child_process').exec;

exports.ssh_server_running = function(callback){

	exec('/usr/sbin/systemsetup -getremotelogin', function(err, stdout){
		callback(!err && stdout && !!stdout.toString().trim().match(/On$/));
	});

	/*

	exec('echo "test" | /usr/bin/nc localhost 22 &> /dev/null && echo 1', function(err, stdout, stderr){
		callback(stdout && stdout.toString() == '1')
	});
	
	*/

};

exports.start_ssh_server = function(callback){
	exec('/usr/sbin/systemsetup -setremotelogin on', callback);
};

exports.stop_ssh_server = function(callback){
	exec('/usr/sbin/systemsetup -setremotelogin off', callback);
};
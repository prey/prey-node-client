"use strict";

//////////////////////////////////////////
// Prey JS Terminal Module Linux Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec = require('child_process').exec,
    os = require('./../../../../../common').os;

exports.ssh_server_running = function(callback){
	os.process_running('sshd', callback);
};

exports.start_ssh_server = function(callback){
	exec('/etc/init.d/ssh start', callback);
};

exports.stop_ssh_server = function(callback){
	exec('/etc/init.d/ssh stop', callback);
};


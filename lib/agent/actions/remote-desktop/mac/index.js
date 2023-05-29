"use strict";

var exec = require('child_process').exec;
var kickstart = "/System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart";

exports.vnc_server_running = function(callback){

	exec('echo "test" | /usr/bin/nc localhost 5900 &> /dev/null && echo 1', function(err, stdout, stderr){
		callback(stdout && stdout.toString().trim() === '1');
	});

};

exports.vnc_command = function(options){
	var str = kickstart + ' -activate -restart -agent';
	str += ' -console -menu';
	str += ' -configure -access -on';
	str += ' -privs -all -allowAccessFor -allUsers';
	str += ' -clientopts -setvnclegacy -vnclegacy yes';
	str += ' -setreqperm -reqperm yes';
	if (options.pass) str += ' -setvncpw -vncpw ' + options.pass;
	return str;
};

/*
exports.stop_vnc = function(callback){
	exec(kickstart + ' -stop -deactivate', callback);
}
*/

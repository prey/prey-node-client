var kickstart = "/System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart";
var exec = require('child_process').exec;

exports.stop_vnc = function(callback){
	exec(kickstart + ' -stop -deactivate', callback);
}

exports.vnc_command = function(options){
	var str = kickstart + ' -activate -restart -agent -configure -access';
	str += ' -on -clientopts -setvnclegacy -vnclegacy yes -setreqperm -reqperm yes';
	if(options.pass) str += '-setvncpw -vncpw $desktop__vnc_pass';
	// str += "-privs -all -allowAccessFor -allUsers";
	return str;
}
#!/usr/local/bin/node
// this program installs required dependencies and sets up
// system configuration files for the network trigger daemon

var execFile = require('child_process').execFile;
var os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

var run = function(script_name, callback){

	execFile(__dirname + '/' + script_name, function(err, stdout, stderr){

		if(stderr.length > 0) console.log(stderr.toString());
		if(stdout.length > 0) console.log(stdout.toString());
		callback(err);

	})

}

run('install_deps.js', function(err){

	if(err) return console.log(err);
	console.log("Dependencies in place!")

	if(process.getuid() != 0){
		var msg = "\nYou're running this script as an unprivileged user";
		msg +=  "\nso we cannot continue with the system configuration.";
		msg +=  "\nTo finalize the install process please run: \n\n";
		msg +=  "\t$ sudo ./scripts/post_install.js\n";
		console.log(msg);
		process.exit()
	}

	run(os_name + '/post_install.js', function(err){
		
		if(err) return console.log(err);
		console.log("System setup successful!");
		
	})
	
});
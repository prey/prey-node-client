#!/usr/local/bin/node
// this program installs required dependencies and sets up
// system configuration files for the network trigger daemon

var path = require('path'),
		execFile = require('child_process').execFile,
		os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
		line = '\n=====================================================\n',
		prey_bin = '/usr/local/bin/prey';

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
		var msg =  'You are running this script as an unprivileged user';
			 msg +=  '\nso we cannot continue with the system configuration.';
			 msg +=  '\nTo finalize the install process please run: \n\n';
			 msg +=  '  $ sudo scripts/post_install.js';
		console.log(line + msg + line);
		process.exit(0)
	}
	
	// make sure the executable exists before setting up any triggers

	path.exists(prey_bin, function(exists){
		
		if(!exists){
			var msg = "We couldn't found the Prey executable in " + prey_bin;
				 msg += "\nIf you installed the package locally, then link it to the\n";
				 msg += "\nglobal path by running: \n\n  $ sudo npm link";
			console.log(line + msg + line);
			process.exit(1);
		}

		run(os_name + '/post_install.js', function(err){

			if(err) return console.log(err);
			console.log("System setup successful!");

		});

	});
	
});
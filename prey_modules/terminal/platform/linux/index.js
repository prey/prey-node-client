//////////////////////////////////////////
// Prey JS Terminal Module Linux Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require(process.env.ROOT_PATH + "/lib/base");

exports.ssh_server_running = function(){

	base.helpers.run_cmd('ps aux | grep sshd > /dev/null && echo 1', function(output){

		if(output == null || output == "")
			return false;
		else
			return true;

	});

}

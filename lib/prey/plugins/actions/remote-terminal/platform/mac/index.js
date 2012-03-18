//////////////////////////////////////////
// Prey JS Terminal Module Mac Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec = require('child_process').exec;

exports.ssh_server_running = function(){

	exec('echo "test" | nc localhost 22 &> /dev/null && echo 1', function(err, stdout, stderr){

		callback(output && output.toString() == '1')

	});

}

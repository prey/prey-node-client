/* by tomas pollak */

var sys = require('sys'), events = require('events'), child = require('child_process');

var cmd = function(str){

	var self = this;
	var run = function(){
		child.exec(str, function(error, stdout, stderr){
			self.emit('return', stdout);
		});
	}

	run();

};

sys.inherits(cmd, events.EventEmitter);
exports.cmd = cmd;

// example:

//	var system = require('./lib/system');
//	var cmd = new system.cmd('ls -al');

//	cmd.on('return', function(output) {
//		console.log(output);
//	});

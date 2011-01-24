/* by tomas pollak */

var sys = require('sys'), events = require('events'), child = require('child_process');

var Command = function(str){

	var self = this;
	var run = function(){
		// child.exec(str);

		child.exec(str, function(error, stdout, stderr){
			if(error) self.emit('error', error);
			else self.emit('return', stdout);
		});
	}

	run();

};

sys.inherits(Command, events.EventEmitter);

exports.run = function(cmd){
	return new Command(cmd);
}

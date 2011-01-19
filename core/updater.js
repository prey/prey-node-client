/* by tomas pollak */

var sys = require('sys'), events = require('events'), download = require('../lib/download'), util = require('util');

exports.module = function(module_name){
	return new Updater(module_name);
}

var Updater = function(){

	var self = this;
	var run = function(name){

		var dw = download.file('http://dropbox.bootlog.org/descaro2.png')

		dw.on('complete', function(filename, status){
			console.log('All done.' + status.bytes + " transferred in " + status.time + " seconds.")
//			unzip.file(filename, function(){
//
//			})

// 			self.emit('success', stdout);
		})

	}

	run();

}

sys.inherits(Updater, events.EventEmitter);

/* by tomas pollak */

var sys = require('sys'),
		events = require('events'),
		download = require('../lib/download'),
		util = require('util'),
		fs = require('fs'),
		path = require('path'),
		unpack = require('../lib/unpack');

var modules_server = "http://control.preyproject.com";

exports.module = function(module){
	return new ModuleUpdater(module);
}

var ModuleUpdater = function(module){

	var self = this;
	var module = module;
	var remote_package = modules_server + "/modules/" + module.name + ".zip";

	var run = function(){

		var tempfile = path.basename(remote_package)
		var dw = download.do(remote_package, "/tmp/prey-module-" + tempfile);

		dw.on('complete', function(filename, status){
			// console.log('All done. ' + status.bytes + " transferred in " + status.time + " seconds.")

			console.log("Moving paths...")
			fs.rename(module.path, module.path + ".old", function(){

				console.log("Unpacking new module...")
				var unzip = unpack.do(filename, module.path.replace("/" + module.name, ''));

				unzip.on('success', function(){
		 			self.emit('success', "Module in place and ready to roll!");
					fs.unlink(filename);
				})

				unzip.on('error', function(){
		 			self.emit('error', "Couldn't update module. Unzip failed.");
					fs.unlink(filename);
				})

			})

		})

		dw.on('error', function(error_msg){
			this.emit('error', error_msg);
		})

	}

	run();

}

sys.inherits(ModuleUpdater, events.EventEmitter);

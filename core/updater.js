//////////////////////////////////////////
// Prey Updater Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		emitter = require('events').EventEmitter,
		Download = require('download'),
		util = require('util'),
		fs = require('fs'),
		path = require('path'),
		unpack = require('unpack'),
		fs2 = require("../vendor/wrench");

var ModuleUpdater = function(module){

	var self = this;
	var module = module;
	var remote_package = config.modules_url + module.name + ".zip";

	var run = function(){

		var tempfile = path.basename(remote_package)
		var dw = new Download(remote_package, tempfile_path("prey-module-" + tempfile));

		dw.on('complete', function(filename, status){
			// console.log('All done. ' + status.bytes + " transferred in " + status.time + " seconds.")

			console.log(" -- Backing up files...")
			fs.rename(module.path, module.path + ".old", function(err){

				console.log(" -- Unpacking new module...")
				var unzip = unpack.do(filename, module.path.replace("/" + module.name, ''));

				unzip.on('success', function(){
					console.log(" -- Module successfully unpacked.")
		 			self.emit('success');
					fs.unlink(filename);
					if(!err) fs2.rmdirSyncRecursive(module.path + ".old")
				})

				unzip.on('error', function(){
					console.log(" -- Couldn't update module. Unzip failed.")
		 			self.emit('error');
					fs.unlink(filename);
					if(!err) fs.rename(module.path + ".old", module.path); // put it back
				})

			})

		})

		dw.on('error', function(error_msg){
			this.emit('error', error_msg);
		})

	}

	run();

}

sys.inherits(ModuleUpdater, emitter);

exports.module = function(module){
	return new ModuleUpdater(module);
}

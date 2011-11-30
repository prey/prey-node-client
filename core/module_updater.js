//////////////////////////////////////////
// Prey Module Updater Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('./base'),
		util = require('util'),
		emitter = require('events').EventEmitter,
		util = require('util'),
		fs = require('fs'),
		path = require('path'),
		helpers = require('./helpers'),
		Download = require('../lib/download'),
		unpack = require('../lib/unpack'),
		fs2 = require("wrench");

var modules_url = "http://control.preyproject.com/modules";

function ModuleUpdater(module_name){

	var self = this;
	this.remote_package = modules_url + '/' + module_name + ".zip";
	this.module_path = base.modules_path + '/' + module_name;

	this.get = function(remote_package, module_path){

		var tempfile = path.basename(remote_package);

		var dw = new Download(remote_package, base.helpers.tempfile_path("prey-module-" + tempfile));

		dw.on('complete', function(filename, stats){
			// console.log('All done. ' + stats.bytes + " transferred in " + stats.time + " seconds.")

			console.log(" -- Backing up folder: " + module_path)
			fs.rename(module_path, module_path + ".old", function(err){

				console.log(" -- Unpacking new module...")
				var unzip = unpack.do(filename, module_path.replace("/" + module_name, ''));

				unzip.on('success', function(){
					console.log(" -- Module successfully unpacked.")
		 			self.emit('success');
					fs.unlink(filename);
					if(!err) fs2.rmdirSyncRecursive(module_path + ".old")
				})

				unzip.on('error', function(){
					console.log(" -- Couldn't update module. Unzip failed.")
		 			self.emit('error');
					fs.unlink(filename);
					if(!err) fs.rename(module_path + ".old", module_path); // put it back
				})

			})

		})

		dw.on('error', function(error_msg){
			this.emit('error', error_msg);
		})

	}

	this.get(this.remote_package, this.module_path);

}

util.inherits(ModuleUpdater, emitter);
module.exports = ModuleUpdater;

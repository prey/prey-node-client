//////////////////////////////////////////
// Prey ProcessWatcher Plugin
// (c) 2012 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		Processes = require('./../../providers/processes'),
		Emitter = require('events').EventEmitter;

var ProcessWatcher = function(options){
	
	var self = this;
	this.interval = options.interval || 3000; // every five seconds
	
	this.watch = function(){
		
		var last_list;
				
		var getter_callback = function(err, list){

			// console.log("Got " + list.length + " active processes.");
			if(err) return self.unwatch(err);

			var list_by_pid = self.sort_by_pid(list);
			if(!last_list) return last_list = list_by_pid;

			self.check_closed(list_by_pid, last_list);
			self.check_opened(list_by_pid, last_list);
			
			last_list = list_by_pid;
			
		};
		
		this.loop = setInterval(function(){

			Processes.get('full_process_list', getter_callback);
			
		}, this.interval);

	};
	
	this.sort_by_pid = function(list){
		var list_by_pid = {};
		list.forEach(function(process){
			list_by_pid[process.pid] = process;
		});
		return list_by_pid;
	}

	
	// checks if a process was on the previous list and not in current one
	this.check_closed = function(current, previous){

		// console.log("Checking if any process was closed...");

		for(pid in previous){
			if(!current[pid])
				self.emit('program_closed', previous[pid].name);
		}

	};

	// checks if a process is on the current list and not in the previous one
	this.check_opened = function(current, previous){

		// console.log("Checking for opened processes...");

		for(pid in current){
			if(!previous[pid])
				self.emit('program_opened', current[pid].name);
		}

	};
	
	this.unwatch = function(err){
		if(err) this.emit('error', err);
		clearTimeout(this.loop);
	}
	
}

util.inherits(ProcessWatcher, Emitter);

exports.events = ['program_opened', 'program_closed'];

exports.start = function(options, callback){
	this.watcher = new ProcessWatcher(options);
	this.watcher.watch();
	callback();
	return this.watcher;
}

exports.stop = function(){
	if(this.watcher)
		this.watcher.unwatch();
}
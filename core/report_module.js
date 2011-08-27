//////////////////////////////////////////
// Prey Report Module Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		PreyModule = require('./prey_module');

function ReportModule(){

	PreyModule.call(this);
	var self = this;
	this.type = 'report';

	// console.log('report module initialized');
	this.traces = {};

	this.traces_called = [];
	this.traces_returned = 0;

	this.run = function(){
		this.trace_methods.forEach(function(trace){
			if(self.traces[trace]) {
				// if its part of the list to be fetched,
				// increment counter as someone already asked for it
				// self.trace_returned(trace);
			} else {
				self.get_trace(trace); // go get it
			}
		});
		this.once('all_traces_returned', function(){
			self.done();
		});
	};

	this.get = function(trace, callback){
		if(this.traces[trace]) {
			callback(this.traces[trace]);
		} else {
			this.get_trace(trace, callback);
		}
	};

	this.on('trace', function(key, val){
		if(val) this.store_trace(key, val);
	});

	this.get_trace = function(trace){
		var callback = arguments[1];
		var method = 'get_' + trace;

		self.once(trace, function(val, err){
			if(val) this.store_trace(trace, val);
			self.trace_returned(trace);
			if(callback) callback(val);
		});

		if(self.traces_called.indexOf(trace) == -1) {
			console.log(' == Calling ' + method);
			self.traces_called.push(trace);
			self[method]();
		}
	};

	this.in_trace_methods = function(trace){
		return(this.trace_methods.indexOf(trace) != -1);
	}

	this.store_trace = function(key, val){
		log(" ++ [" + this.name + "] Got trace: " + key + " -> " + val);
		if(val) this.traces[key] = val;
	}

	this.trace_returned = function(trace){

		if(!self.trace_methods || !self.in_trace_methods(trace)) return;

		this.traces_returned++;
		// console.log(self.name + ": " + trace + " -- " + self.traces_returned + "/" + self.trace_methods.length)

		if(!this.traces_pending())
			this.emit('all_traces_returned');
	}

	this.traces_pending = function(){
		return (this.traces_returned < this.trace_methods.length);
	}

	this.list_traces = function(){
		console.log(this.traces);
	}

};

sys.inherits(ReportModule, PreyModule);
module.exports = ReportModule;

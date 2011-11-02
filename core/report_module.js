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

	this.reset = function(){
		this.traces = {};
		this.traces_called = [];
		this.traces_returned = 0;
	}

	this.run = function(){

		this.running = true;

		this.trace_methods.forEach(function(trace){
			if(typeof self.traces[trace] === 'undefined') {
				self.get_trace(trace); // go get it
			}
		});

		this.once('all_traces_returned', function(){
			self.done();
		});

	};

	this.get = function(trace, callback){
		if(typeof this.traces[trace] !== 'undefined') {
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
			this.store_trace(trace, val);
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
		this.log("Got trace: " + key + " -> " + val);
		// if(val) this.traces[key] = val;
		this.traces[key] = val;
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

	this.reset();

};

sys.inherits(ReportModule, PreyModule);
module.exports = ReportModule;

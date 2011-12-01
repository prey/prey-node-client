//////////////////////////////////////////
// Prey Info Module Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		PreyModule = require('./prey_module');

function InfoModule(){

	PreyModule.call(this);
	var self = this;
	this.type = 'report';

	this.reset = function(){
		if(self.name && process.env.LOOP)
			self.log("Resetting! Current loop: " + process.env.LOOP);

		this.traces = {};
		this.traces_called = [];
		this.traces_returned = 0;
	}

	this.start = function(){

		if(process.env.LOOP && process.env.LOOP > 1) this.reset();

		this.trace_methods.forEach(function(trace){
			if(typeof self.traces[trace] === 'undefined')
				self.get_trace(trace); // go get it
		});

		this.once('all_traces_returned', function(){
			self.done();
		});

	};

	// this methods lets us do:
	// Network.get('public_ip', function(result){ /* bla bla */ });
	// or, in case the method expects an argument:
	// Network.get('mac_address', 'eth0', function(result){ /* bla bla */ });

	this.get = function(trace, opts, callback){
		if(typeof callback == 'undefined') callback = opts;

		if(typeof this.traces[trace] !== 'undefined') {
			callback(this.traces[trace]);
		} else {
			this.get_trace(trace, opts, callback);
		}
	};

	this.on('trace', function(key, val){
		if(val) this.store_trace(key, val);
	});

	this.get_trace = function(trace, opts, callback){
		if(typeof callback == 'undefined') callback = (typeof opts == 'undefined') ? false : opts;
		var method = 'get_' + trace;

		self.once(trace, function(val, err){
			this.store_trace(trace, val);
			self.trace_returned(trace);
			if(callback) callback(val);
		});

		if(self.traces_called.indexOf(trace) == -1) {
			// console.log(' == Calling ' + method);
			self.traces_called.push(trace);
			self[method](opts);
		}
	};

	this.in_trace_methods = function(trace){
		return(this.trace_methods.indexOf(trace) != -1) ? true : false;
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

util.inherits(InfoModule, PreyModule);
module.exports = InfoModule;

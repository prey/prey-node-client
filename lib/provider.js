//////////////////////////////////////////
// Prey Info Module Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		util = require('util'),
		emitter = require('events').EventEmitter;

function Provider(){

	var self = this;
	this.type = 'report';
	this.trace_expiration = 30 * 1000; // 30 seconds

	this.log = function(str){
		logger.info(" ++ [" + this.name + "] " + str);
	};

	this.reset = function(){
		if(self.name && process.env.LOOP)
			self.log("Resetting! Current loop: " + process.env.LOOP);

		this.traces = {};
		this.traces_requested = [];
		this.traces_returned = 0;
	}

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

		if(self.traces_requested.indexOf(trace) == -1) {
			// console.log(' == Requesting ' + method);
			self.traces_requested.push(trace);
			self[method](opts);
		}
	};

	this.store_trace = function(key, val){
		this.log("Got trace: " + key + " -> " + val);
		// if(val) this.traces[key] = val;
		this.traces[key] = val;

		// info may change in time so let's remove it after a while
		// setTimeout(function(){
		// 	delete self.traces[key];
		// }, this.trace_expiration);

	}

	this.trace_returned = function(trace){

		if(!this.getters || !this.in_getters(trace)) return;

		this.traces_returned++;
		// console.log(self.name + ": " + trace + " -- " + self.traces_returned + "/" + self.getters.length)

		if(!this.traces_pending())
			this.emit('all_traces_returned');
	}

	this.in_getters = function(trace){
		return(this.getters.indexOf(trace) != -1) ? true : false;
	}

	this.traces_pending = function(){
		return (this.traces_returned < this.getters.length);
	}

	this.reset();

};

util.inherits(Provider, emitter);
module.exports = Provider;

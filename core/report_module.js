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

	this.traces_in_process = [];
	this.traces_returned = 0;

	this.run = function(){
		this.trace_methods.forEach(function(trace_name){
			self.get_trace(trace_name);
		});
	};

	this.on('trace', function(key, val){
		if(val) this.add_trace(key, val);
	});

	this.add_trace = function(key, val){
		log(" ++ [" + this.name + "] Got trace: " + key + " -> " + val);
		this.traces[key] = val;
	}

	this.get_trace = function(trace){
		var callback = arguments[1];
		var method = 'get_' + trace;

		self.once(trace, function(val, err){
			if(callback) callback(val); // trace requested by someone else
			else self.trace_returned(trace, val, err); // from run()
		});

		if(self.traces_in_process.indexOf(trace) == -1) {
			console.log(' == Calling ' + method);
			self.traces_in_process.push(trace);
			self[method]();
		}
	};

	this.get = function(trace, callback){
		if(this.traces[trace]) {
			// console.log('already there')
			callback(this.traces[trace]);
		} else {
			// console.log('not there')
			this.get_trace(trace, callback);
		}
	};

	this.traces_pending = function(){
		// console.log(self.traces_returned + "/" + self.trace_methods.length)
		return (this.traces_returned < this.trace_methods.length);
	}

	this.trace_returned = function(trace, val, err){
		if(val) this.add_trace(trace, val)

		this.traces_returned++;
		if(!this.traces_pending())
			this.done();
	}


	this.list_traces = function(){
		console.log(this.traces);
	}

};

sys.inherits(ReportModule, PreyModule);
module.exports = ReportModule;

//////////////////////////////////////////
// Prey Report Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./../../../common').logger,
		util = require('util'),
		fs = require('fs'),
		emitter = require('events').EventEmitter;

function mixin(target, source){
	Object.keys(source).forEach(function(key) {
		target[key] = source[key];
	});
	return target;
}

var Report = function(){

	var self = this;
	this.traces = {};

	this.base_info = {
		'public_ip': true,
		'private_ip': true,
		'first_mac_address': true,
		'location': true
	};

	this.log = function(str){
		logger.info("[report] " + str);
	};

	this.packed = function(data){
		this.log("All info packed!");
		this.traces = data;
		if(process.env.DEBUG) console.log(data);
		this.emit('gathered', data)
	};

	this.gather = function(additional_info){

		var provider = require('./../../../provider_hub');
		var info_to_gather = mixin(this.base_info, additional_info);

		provider.get_many(info_to_gather, function(data){
			self.packed(data);
		});

	};

}

util.inherits(Report, emitter);
// exports.events = ['gathered'];

exports.start = function(options, callback){

	var report = new Report();
	report.once('gathered', function(data){
		callback(true, data);
	});
	report.gather(options);

};

exports.stop = function(){
	// noop
}
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

var Report = function(additional_info){

	var self = this;
	this.traces = {};

	this.base_info = {
		'public_ip': true,
		'private_ip': true,
		'first_mac_address': true,
		'location': true
	};
	
	this.info_to_gather = mixin(this.base_info, additional_info);

	this.log = function(str){
		logger.info("[report] " + str);
	};

	this.gather = function(callback){

		var provider = require('./../../../provider_hub');

		provider.get_many(this.info_to_gather, function(err, data){
			callback(null, data);
		});

	};

}

// util.inherits(Report, emitter);
// exports.events = ['gathered'];

exports.start = function(options, callback){

	var report = new Report(options);
	report.gather(callback);

};

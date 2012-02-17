//////////////////////////////////////////
// Prey JS Hardware Scan Plugin
// Written by Tomas Pollak <tomas@forkhq.com>
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		Hardware = require('./../../providers/hardware');

var HardwareScan = function(options){

	var self = this;

	this.get_info = function(callback){

		var data = {};

		Hardware.getters.forEach(function(info){

			Hardware.get(info, function(err, result){

				if(!err)
					data[info] = result;

			});

		});

		callback(null, data);

	};

};

exports.start = function(options, callback){
	var scanner = new HardwareScan(options);
	scanner.get_info(callback);
};
var util = require('util'),
		emitter = require('events').EventEmitter,
		Hardware = require('../../lib/providers/hardware');

var HardwareScan = function(options){

	var self = this;

	this.get_info = function(){

		setTimeout(function(){

			var data = {
				asd: 'asdasd'
			}

			self.emit('hardware_scanned', data);
			self.emit('end', true);

		}, 5000);

	};

};

util.inherits(HardwareScan, emitter);

exports.start = function(options, callback){
	var scanner = this.scanner = new HardwareScan(options, callback);
	scanner.get_info(options);
	callback(scanner);
};

exports.events = ['hardware_scanned'];

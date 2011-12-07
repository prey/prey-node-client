var util = require('util'),
		emitter = require('events').EventEmitter,
		Hardware = require('../../lib/providers/hardware');

var HardwareScan = function(options){

	var self = this;

	this.start = function(callback){

		this.once('done', function(data){
			self.emit('hardware_scanned', data);
			callback(true);
		});

		this.get_info();

	};

	this.get_info = function(){

		setTimeout(function(){

			var data = {
				asd: 'asdasd'
			}
			self.emit('done', data);
		}, 5000);

	};

};

util.inherits(HardwareScan, emitter);

exports.init = function(options){
	return new HardwareScan(options);
};

exports.events = ['hardware_scanned'];

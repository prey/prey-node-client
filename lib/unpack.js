/*
	File unpacker (using system unzip), by Tomas Pollak
	Ugly but it works
*/

var util = require('util'),
		fs = require('fs'),
		path = require('path'),
		emitter = require('events').EventEmitter,
		Command = require('./command');

exports.do = function(file){
	var destination = arguments[1] || false;
	return new Unpack(file, destination);
}

function Unpack(file, destination){

	var self = this;

	var init = function(file, destination){

		var cmd_str = "unzip " + file;
		cmd_str += destination ? " -d " + destination : '';
		var cmd = new Command(cmd_str);

		cmd.on('error', function(err){
			self.emit('error', err);
		})

		cmd.on('return', function(err){
			self.emit('success');
		})
	}

	init(file, destination);

}

util.inherits(Unpack, emitter);

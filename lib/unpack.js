/*
	HTTP fetcher, by Tomas Pollak
*/

var sys = require('sys'),
		command = require('./command'),
		fs = require('fs'),
		path = require('path'),
		util = require('util'),
		events = require('events');

exports.do = function(file){
	var destination = arguments[1] || false;
	return new Unpack(file, destination);
}

function Unpack(file, destination){

	var self = this;

	var init = function(file, destination){

		var cmd_str = "/usr/bin/unzip " + file;
		cmd_str += destination ? " -d " + destination : '';
		console.log(cmd_str)
		var cmd = command.run(cmd_str);

		cmd.on('error', function(err){
			self.emit('error');
		})

		cmd.on('return', function(err){
			self.emit('success');
		})
	}

	init(file, destination);

}

sys.inherits(Unpack, events.EventEmitter);

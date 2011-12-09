//////////////////////////////////////////
// Prey JS System Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('../../common'),
		util = require('util'),
		os = require('os'),
		Command = require('command'),
		InfoModule = require('../../info_module');

var System = function(){

	InfoModule.call(this);
	var self = this;
	this.name = 'system';

	this.get_current_uptime = function(){

		self.emit('current_uptime', parseInt(os.uptime()));

	};

	this.get_remaining_battery = function(){

		self.emit('remaining_battery', 100);

	};

	this.get_cpu_usage = function(){
		// TODO
	};

	this.get_mem_usage = function(){
		// TODO
	};

	this.get_logged_user = function(){
		// TODO
	};

};

util.inherits(System, InfoModule);
module.exports = new System();

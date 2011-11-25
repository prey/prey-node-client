//////////////////////////////////////////
// Prey JS Session Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('../../core/base'),
		util = require('util'),
		path = require('path'),
		uptime = require('os').uptime
		Command = require('../../lib/command'),
		ReportModule = require('../../core/report_module'),
		os_functions = require('./platform/' + base.os_name);

var Session = function(){

	ReportModule.call(this);
	var self = this;
	this.name = 'session';

	this.options = {
		screenshot_file: 'screenshot.jpg'
	}

	this.trace_methods = [
		'current_uptime',
		'screenshot'
	]

	this.get_screenshot = function(){

		GStreamer.captureFrame('desktop', this.options.screenshot_file, function(file){

			if(file)
				self.emit('screenshot', {path: file, type: 'image/jpg'});
			else
				self.emit('screenshot', false);

		});

	};

	this.get_current_uptime = function(){

		self.emit('current_uptime', parseInt(uptime()));

	};

};

util.inherits(Session, ReportModule);
module.exports = new Session();

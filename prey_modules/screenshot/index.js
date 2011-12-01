//////////////////////////////////////////
// Prey JS Session Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('../../core/base'),
		util = require('util'),
		GStreamer = require('node-gstreamer'),
		ReportModule = require('../lib/info_module'),
		os_functions = require('./platform/' + base.os_name);

var Screenshot = function(){

	InfoModule.call(this);
	var self = this;
	this.name = 'session';

	this.options = {
		screenshot_file: 'screenshot.jpg'
	}

	this.trace_methods = [
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

};

util.inherits(Session, InfoModule);
module.exports = new Screenshot();

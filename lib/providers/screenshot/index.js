//////////////////////////////////////////
// Prey JS Screenshot Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('../../common'),
		util = require('util'),
		GStreamer = require('node-gstreamer'),
		InfoModule = require('../../info_module'),
		os_functions = require('./platform/' + common.os_name);

var Screenshot = function(){

	InfoModule.call(this);
	var self = this;
	this.name = 'screenshot';

	this.getters = [
		'screenshot'
	]

	this.get_screenshot = function(options){

		var screenshot_file = options.screenshot_file || 'screenshot.jpg';

		GStreamer.captureFrame('desktop', screenshot_file, function(file){

			if(file)
				self.emit('screenshot', {path: file, type: 'image/jpg'});
			else
				self.emit('screenshot', false);

		});

	};

};

util.inherits(Screenshot, InfoModule);
module.exports = new Screenshot();

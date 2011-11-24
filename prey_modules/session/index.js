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

		var temp_screenshot = base.helpers.tempfile_path(this.options.screenshot_file);

		var str = base.os.current_user_cmd(os_functions.screenshot_cmd + " " + temp_screenshot);

		var cmd = new Command(str);

		cmd.on('return', function(output){
			path.exists(temp_screenshot, function(exists){
				var return_val = exists ? {path: temp_screenshot, type: 'image/jpg'} : false;
				self.emit('screenshot', return_val);
			});

		});

		cmd.on('error', function(err){
			self.emit('screenshot', false);
		});

	};

	this.get_current_uptime = function(){

		self.emit('current_uptime', parseInt(uptime()));

	};

};

util.inherits(Session, ReportModule);
module.exports = new Session();

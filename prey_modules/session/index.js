//////////////////////////////////////////
// Prey JS Session Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('../../core/base'),
		sys = require('sys'),
		path = require('path'),
		helpers = require('../../core/helpers'),
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

		var temp_screenshot = helpers.tempfile_path(this.options.screenshot_file);

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

		var cmd = new Command('cat /proc/uptime');

		cmd.on('error', function(e){
			self.emit('current_uptime', false, e);
		});

		cmd.on('return', function(output){
			var seconds = parseInt(output.split()[0]);
			self.emit('current_uptime', seconds);
		});


	};

};

sys.inherits(Session, ReportModule);
module.exports = new Session();

//////////////////////////////////////////
// Prey JS Screenshot Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		tempfile_path = common.helpers.tempfile_path,
		util = require('util'),
		path = require('path'),
		Provider = require('./../../../provider'),
		exec = require('child_process').exec,
		os_functions = require('./platform/' + common.os_name);

var Screenshot = function(){

	Provider.call(this);
	var self = this;
	this.name = 'screenshot';

	this.getters = [
		'screenshot'
	];

	this.get_screenshot = function(options, callback){

		var file_path = options.screenshot_file || tempfile_path('screenshot.' + process.pid + '.jpg');

		common.helpers.run_as_logged_user(os_functions.screenshot_cmd, [file_path], function(err, stdout, stderr){

			if(err) return self.emit('screenshot', err);

			path.exists(file_path, function(exists){
				if(exists)
					callback(null, {file: file_path, content_type: 'image/jpeg'});
				else
					callback(new Error("Unable to get screenshot."));
			})

		})

	};

};

util.inherits(Screenshot, Provider);
module.exports = new Screenshot();

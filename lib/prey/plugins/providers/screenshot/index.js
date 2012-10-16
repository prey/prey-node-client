"use strict";

//////////////////////////////////////////
// Prey JS Screenshot Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = _ns('common'),
    //helpers = _ns('helpers'),
		tempfile_path = common.helpers.tempfile_path,
		file_exists = require('fs').exists,
    os_functions = require('./platform/' + common.os_name),
    exec = require('child_process').exec;

exports.get_screenshot = function(callback) {
  //		var file_path = options.screenshot_file || tempfile_path('screenshot.' + process.pid + '.jpg');
  var file_path = tempfile_path('screenshot.' + process.pid + '.jpg');
	//helpers.run_as_logged_user(os_functions.screenshot_cmd, [file_path], function(err) {
  exec(os_functions.screenshot_cmd +' '+file_path, function(err) {
		if (err) return callback(_error(err));

		file_exists(file_path, function(exists){
			if (exists)
				callback(null, {file: file_path, content_type: 'image/jpeg'});
			else
				callback(_error("Unable to get screenshot."));
		});
    
	});
};

exports.get_screenshot.arity = 0;


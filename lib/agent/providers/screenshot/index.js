"use strict";

//////////////////////////////////////////
// Prey JS Screenshot Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common        = require('./../../common'),
    helpers       = common.helpers,
		temp_path     = common.system.tempfile_path,
		exists   = require('fs').exists,
    os_functions  = require('./' + common.os_name);

exports.get_screenshot = helpers.report(function(callback) {

 	var file_path = options.file || temp_path('screenshot.' + process.pid + '.jpg');

	helpers.run_as_logged_user(os_functions.screenshot_cmd, [file_path], function(err) {

		if (err) return callback(_error(err));

		file_exists(file_path, function(exists){
			if (exists)
				callback(null, {file: file_path, content_type: 'image/jpeg'});
			else
				callback(_error("Unable to get screenshot."));
		});

	});
});

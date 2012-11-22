"use strict";

//////////////////////////////////////////
// Prey JS Webcam Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs           = require('fs'),
    common       = require('./../../common'),
    temp_path    = common.system.tempfile_path,
    os_functions = require('./' + common.os_name);

exports.get_picture = function(options, callback){

	var file_path = options.file || temp_path('picture.' + process.pid + '.jpg');

	os_functions.get_picture(file_path, function(err, file_type){
		if (err) return callback(_error(err));

		fs.exists(file_path, function(exists){
			if (!exists) return callback(_error("Couldn't grab a picture using the webcam."));

			callback(null, {file: file_path, content_type: file_type});
		});
	});

};

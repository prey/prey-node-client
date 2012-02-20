//////////////////////////////////////////
// Prey JS Webcam Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		tempfile_path = common.helpers.tempfile_path,
		util = require('util'),
		GStreamer = require('node-gstreamer'),
		Provider = require('./../../../provider');
//		os_functions = require('./platform/' + common.os_name);

var Webcam = function(){

	Provider.call(this);
	var self = this;
	this.name = 'webcam';

	this.getters = [
		'picture'
	];

	this.get_picture = function(options){

		var file_path = options.picture_file || tempfile_path('picture.' + process.pid + '.jpg');

//		os_functions.run_picture_cmd(this.options.picture_file, function(file, extension){
		GStreamer.captureFrame('webcam', file_path, function(file){

			if(file)
				self.emit('picture', null, {file: file_path, content_type: 'image/jpeg'});
			else
				self.emit('picture', new Error("Couldn't grab a picture using the webcam."));

		});

	};

};

util.inherits(Webcam, Provider);
module.exports = new Webcam();

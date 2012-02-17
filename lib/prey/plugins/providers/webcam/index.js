//////////////////////////////////////////
// Prey JS Webcam Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
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

		var picture_file = options.picture_file || 'picture.jpg';

//		os_functions.run_picture_cmd(this.options.picture_file, function(file, extension){
		GStreamer.captureFrame('webcam', picture_file, function(file){

			if(file)
				self.emit('picture', null, {file: file, content_type: 'image/jpeg'});
			else
				self.emit('picture', new Error("Couldn't grab a picture using the webcam."));

		});

	};

};

util.inherits(Webcam, Provider);
module.exports = new Webcam();

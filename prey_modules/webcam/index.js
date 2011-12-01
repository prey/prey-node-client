//////////////////////////////////////////
// Prey JS Webcam Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('../../core/base'),
		util = require('util'),
		GStreamer = require('node-gstreamer'),
		InfoModule = require('../../core/info_module'),
		os_functions = require('./platform/' + base.os_name);

var Webcam = function(){

	InfoModule.call(this);
	var self = this;
	this.name = 'webcam';

	this.options = {
		picture_file: 'picture.jpg'
	}

	this.trace_methods = [
		'picture'
	]

	this.get_picture = function(){

//		os_functions.run_picture_cmd(this.options.picture_file, function(file, extension){
		GStreamer.captureFrame('webcam', this.options.picture_file, function(file){

			if(file)
				self.emit('picture', {path: file, type: 'image/jpg'});
			else
				self.emit('picture', false);

		});

	};

};

util.inherits(Webcam, InfoModule);
module.exports = new Webcam();

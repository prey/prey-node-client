//////////////////////////////////////////
// Prey JS Webcam Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('../../common'),
		util = require('util'),
		GStreamer = require('node-gstreamer'),
		InfoModule = require('../../info_module'),
		os_functions = require('./platform/' + common.os_name);

var Webcam = function(){

	InfoModule.call(this);
	var self = this;
	this.name = 'webcam';

	this.getters = [
		'picture'
	]

	this.get_picture = function(options){

		var picture_file = options.picture_file || 'picture.jpg';

//		os_functions.run_picture_cmd(this.options.picture_file, function(file, extension){
		GStreamer.captureFrame('webcam', picture_file, function(file){

			if(file)
				self.emit('picture', {path: file, type: 'image/jpg'});
			else
				self.emit('picture', false);

		});

	};

};

util.inherits(Webcam, InfoModule);
module.exports = new Webcam();

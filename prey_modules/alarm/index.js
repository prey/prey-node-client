//////////////////////////////////////////
// Prey JS Alarm Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var GStreamer = require('node-gstreamer');

function Alarm(options){

	this.sound_file = options.sound_file || __dirname + '/lib/siren.mp3';
	this.loops = options.loops || 1;

	this.start = function(callback){
		var returned = false;

		for(i = 0; i < this.loops; i++){
			console.log("Playing alarm sound!");
			GStreamer.playSound(this.sound_file, function(was_played){
				if(!returned) callback(was_played);
			});
		}
	}

}

exports.init = function(options){
	return new Alarm(options);
}

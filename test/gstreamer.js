// var GStreamer = require(__dirname + '../node_modules/gstreamer');
var GStreamer = require('node-gstreamer');
var fs = require('fs');

GStreamer.captureFrame({width: 320, height: 240}, function(file){
	if(file){
		console.log("Picture taken: " + file);
		fs.unlink(file);
	} else {
		console.log("Picture NOT taken. Camera in use?");
	}
});

GStreamer.playSound({file: '/home/tomas/documentos/ANTEND.WAV'}, function(file_played){
	if(file_played)
		console.log('Sound played: ' + file_played);
});

GStreamer.streamVideo({dest: 'localhost:9000', encoder: 'vp8enc'}, function(success){
	if(success)
		console.log('Stream is running!');
});

GStreamer.streamAudioVideo({dest: 'file.webm', encoder: 'vp8enc'}, function(success){
	if(success)
		console.log('Stream is running!');
});

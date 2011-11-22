// var GStreamer = require(__dirname + '../node_modules/gstreamer');
var GStreamer = require('node-gstreamer');
var fs = require('fs');

var command = process.argv[2];

if(typeof command == 'undefined')
  process.exit();

if(command == 'frame'){

GStreamer.captureFrame('desktop', __dirname + '/frame.jpg', {width: 320, height: 240}, function(file){
	if(file){
		console.log("Picture taken: " + file);
		// fs.unlink(file);
	} else {
		console.log("Picture NOT taken. Camera in use?");
	}
});

} else if (command == 'sound'){

var file = process.argv[3];

GStreamer.playSound(file, function(file_played){
	if(file_played)
		console.log('Sound played: ' + file_played);
	else
		console.log('File not played!');
});

} else if(command == 'video'){

GStreamer.streamVideo('videotestsrc', {buffers: 100, dest: 'file.flv', encoder: 'ffenc_flv'}, function(success){
	if(success)
		console.log('Stream is running!');
	else
		console.log('Stream NOT running!');
});

} else if(command == 'audiovideo'){

GStreamer.streamVideoWithAudio('webcam', {dest: 'localhost:9000', encoder: 'vp8enc'}, function(success){
	if(success)
		console.log('Stream is running!');
	else
		console.log('Stream NOT running!');
});

}

//////////////////////////////////////////
// Prey JS Webcam Module Linux Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../../../common'),
		fs = require('fs'),
		path = require('path'),
		exec = require('child_process').exec;

exports.get_picture_cmd = function(picture_file, main_callback){

	// var temp_picture = common.helpers.tempfile_path(picture_file);

	function frame_file(number, extension){
		return common.helpers.tempfile_path('streamer' + number.toString() + extension);
	}

	function remove_frames(number){
		for(i = 0; i <= number; i++){
			fs.unlink(frame_file(number));
		}
	}

	function call_streamer(extension, callback){

		var last_frame = frame_file('3', extension);
		var str = 'streamer -t 4 -r 0.5 -o ' + frame_file('0', extension);
		var cmd = exec(str, function(err, stdout, stderr){

			if(err) return callback(err);

			path.exists(last_frame, function(exists){

				if(exists){
					remove_frames(2, extension);
					callback(null, last_frame);
				} else {
					callback(new Error('Could not get image.'));
				}

			});

		});

	}

	call_streamer('.jpeg', function(err, file){

		if(!err && file){

			fs.rename(file, picture_file, function(err) {
				if (err) return main_callback(err);
				main_callback(null, 'image/jpeg');
			});

		} else {

			// console.log("Couldn't get JPEG image. Trying PPM.")
			call_streamer('.ppm', function(err, file){

				if(err) return main_callback(err);

				// convert using imagemagick
				var cmd = 'convert ' + file + ' ' + picture_file;

				exec(cmd, function(err, stdout, stderr){

					if(!err) return main_callback(temp_picture, 'image/jpg'); // converted image
			
					fs.rename(file, picture_file, function(err){
				
						if(err) return main_callback(err);
						else main_callback(null, 'image/ppm'); // return original
				
					});

				});

			});

		}

	});

}

//////////////////////////////////////////
// Prey JS Webcam Module Linux Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
		path = require('path'),
		helpers = require('../../../../core/helpers'),
		Command = require('../../../../core/command');

exports.run_picture_cmd = function(picture_file, main_callback){

		var temp_picture = helpers.tempfile_path(picture_file);

		function frame_file(number, extension){
			return helpers.tempfile_path('streamer' + number.toString() + extension);
		}

		function remove_frames(number){
			for(i = 0; i <= number; i++){
				fs.unlink(frame_file(number));
			}
		}

		function call_streamer(extension, callback){

			var last_frame = frame_file('3', extension);
			var str = 'streamer -t 4 -r 0.5 -o ' + frame_file('0', extension);
			var cmd = new Command(str);

			cmd.on('return', function(output){

				path.exists(last_frame, function(exists){

					if(exists){
						remove_frames(2, extension);
						callback(last_frame);
					} else {
						callback(false);
					}

				});

			});

			cmd.on('error', function(err){
				callback(false, err);
			});

		}

	call_streamer('.jpeg', function(file, err){

		if(file){

			fs.rename(file, temp_picture, function (err) {
				if (err) throw err;
				main_callback(temp_picture);
			});

		} else {

			console.log(" -- Couldn't get JPEG image. Trying PPM.")
			call_streamer('.ppm', function(file, err){

				if(file){

					// convert using imagemagick
					var str = 'convert ' + file + ' ' + temp_picture;

					var cmd = new Command(str)
					.on('return', function(){
						main_callback(temp_picture, 'image/jpg'); // return converted image
					})
					.on('error', function(){
						main_callback(file, 'image/ppm'); // just return the ppm
					});

				} else {
					main_callback(false);
				}

			});

		}

	});

}

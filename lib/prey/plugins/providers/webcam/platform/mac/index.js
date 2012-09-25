var exec = require('child_process').exec,
    picture_timeout = 10 * 1000;

exports.get_picture = function(file, callback){

	var running = true;

	var child = exec(__dirname + '/imagesnap ' + file, function(err, stdout, stderr){

		running = false;
		if (err) return callback(err);
		callback(null, 'image/jpeg');

	})

	// if after 10 seconds the picture hasn't been taken, cancel it.
	setTimeout(function(){
		if (running){
			child.kill();
		}
	}, picture_timeout);

}

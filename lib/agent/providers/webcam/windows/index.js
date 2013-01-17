var exec = require('child_process').exec,
	path = require('path');

exports.get_picture = function(file, callback){
  exec('"' + path.join(__dirname, '/prey-webcam.exe'), function(err) {
  	if (err)
  		callback(err)
  	else
  		callback(null, 'image/jpeg');
  })

}

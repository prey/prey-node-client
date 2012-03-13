var exec = require('child_process').exec;

exports.get_picture = function(file, callback){
	
	exec(__dirname + '/imagesnap ' + file, function(err, stdout, stderr){
		
		if(err) return callback(err);
		callback(null, 'image/jpeg');
		
	})
	
}
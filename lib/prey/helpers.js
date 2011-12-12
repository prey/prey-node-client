var common = require('./common'),
		logger = common.logger,
		fs = require('fs'),
		path = require('path'),
		exec = require('child_process').exec;

exports.check_and_store_pid = function(pid_file, callback){

	if(path.existsSync(pid_file)){

		var pid = parseInt(fs.readFileSync(pid_file));
		if(!isNaN(pid)) {

			logger.write("\nPrey seems to be running already! PID: " + pid.toString());

			try {
				process.kill(pid, 0);
				return callback(parseInt(pid));
			} catch(e) {
				logger.write("Not really! Pidfile was just lying around.");
			}

		}

	}

	fs.writeFile(pid_file, process.pid.toString(), function(err){
		if(err) throw("Couldn't save PID file! Cannot continue.");
		callback(false);
	});

};

exports.clean_up = function(pid_file){
	logger.info("Cleaning up!");
	// if(!self.running)
	fs.unlink(pid_file);
}

exports.tempfile_path = function(filename){
	return common.os.temp_path + '/' + filename;
};

exports.replace_in_file = function(file_name, from, to, callback){

	fs.readFile(file_name, function(err, data) {
		if (err) throw err;

		var new_data = data.toString().replace(from, to);
		if(new_data != data)
			fs.writeFile(file_name, data, callback);

	});

};

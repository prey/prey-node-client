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
		if(err) throw("Couldn't save PID in: " + pid_file + "! Cannot continue.");
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

// returns true if first is greater than second
exports.is_greater_than = function(first, second){

	var a = parseFloat(first.replace(/\./g, ''));
	var b = parseFloat(second.replace(/\./g, ''));

	return a > b ? true : false;

};

exports.store_config_value = function(key_name, value, callback){
	var pattern = new RegExp("\t+" + key_name + ":.*");
	var new_value = "\t" + key_name + ": " + JSON.stringify(value) + ",";
	console.log(new_value);
	exports.replace_in_file(common.config_file, pattern, new_value, callback);
};

exports.replace_in_file = function(file_name, from, to, callback){

	fs.readFile(file_name, function(err, data) {
		if (err) throw err;

		var new_data = data.toString().replace(from, to);
		if(data.toString() != new_data)
			fs.writeFile(file_name, new_data, callback);

	});

};

exports.copy_file = function(src, dest, callback){

	var pump = function(){
		
		input = fs.createReadStream(path.resolve(src));
		output = fs.createWriteStream(dest);

		util.pump(input, output, function(err){
		
			if (err) return callback(err);

			console.log('Copied ' + src  + ' to ' + dest);
			input.destroy() && output.destroy();
			callback();

		});

	}

	var dest = path.resolve(dest);
	var base_path = path.dirname(dest);
	if(!path.existsSync(base_path)){
		
		console.log("Creating directory: " + base_path);
		fs.mkdir(base_path, function(err){
			if(err) return callback(err);
			pump();
		})
		
	} else {
		pump();
	}

};

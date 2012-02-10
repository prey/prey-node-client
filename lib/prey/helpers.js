var common = require('./common'),
		logger = common.logger,
		util = require('util'),
		fs = require('fs'),
		path = require('path'),
		exec = require('child_process').exec;

exports.tempfile_path = function(filename){
	return common.os.temp_path + '/' + filename;
};

exports.clean_up = function(pid_file){
	logger.info("Cleaning up!");
	// if(!self.running)
	fs.unlink(pid_file);
}

exports.check_and_store_pid = function(pid_file, callback){

	if(path.existsSync(pid_file)){

		var pid = parseInt(fs.readFileSync(pid_file));
		if(!isNaN(pid)) {

			logger.write("\nPrey seems to be running already! PID: " + pid.toString());

			try {
				process.kill(pid, 0);
				return callback(parseInt(pid));
			} catch(e) {
				// console.log(e);
				logger.write("Not really! Pidfile was just lying around.");
			}

		}

	}

	fs.writeFile(pid_file, process.pid.toString(), function(err){
		if(err) throw("Couldn't save PID in: " + pid_file + "! Cannot continue.");
		callback(false);
	});

};

// returns true if first is greater than second
exports.is_greater_than = function(first, second){

	var a = parseFloat(first.replace(/\./g, ''));
	var b = parseFloat(second.replace(/\./g, ''));

	return a > b ? true : false;

};

exports.random_between = function(from, to){
	return Math.floor(Math.random() * (to - from + 1) + from);
}

exports.store_config_value = function(key, value, callback){
	
	// if(!common.config || !common.config.hasOwnProperty(key))
		// return callback(new Error("Unexisting config key: " + key))
	
	var pattern = new RegExp("\t" + key + ":.*,");
	var new_value = "\t" + key + ": " + JSON.stringify(value) + ",";
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
	path.exists(base_path, function(exists){
		
		if(exists){

			pump();

		} else {

			console.log("Creating directory: " + base_path);
			fs.mkdir(base_path, function(err){
				if(err) return callback(err);
				pump();
			})

		}
		
	});

};

this.remove_files = function(data){

	logger.info("Cleaning up files...");
	for(key in data){

		var val = data[key];

		if(val.file && val.content_type) {

			logger.info("Removing " + key + ": " + val.file)
			fs.unlink(val.file);

		}

	}

};

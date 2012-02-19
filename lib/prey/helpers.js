var common = require('./common'),
		util = require('util'),
		fs = require('fs'),
		path = require('path'),
		exec = require('child_process').exec;

exports.tempfile_path = function(filename){
	return common.os.temp_path + '/' + filename;
};

exports.remove_pid_file = function(pid_file){
	fs.unlink(pid_file);
}

exports.store_pid = function(pid_file, callback){

	fs.readFile(pid_file, function(err, data){
		
		if(!err){ // file exists
		
			var pid = parseInt(data);
			console.error("\nPrey seems to be running already! (PID: " + pid.toString() + ")");

			try {
				process.kill(pid, 0);
				return callback(null, pid);
			} catch(e) {
				console.error("Not really, pidfile was just lying around.\n");
			}

		}

		// if all was good, then callback(err) will be null
		fs.writeFile(pid_file, process.pid.toString(), callback);

	})

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

exports.store_main_config_value = function(key, value, callback){
	exports.store_config_value(['config'], key, value, callback);
//	exports.store_config_value(common.config_file, key, value, callback);
}

exports.store_config_value = function(filename, key, value, callback){
	var data = {};
	data[key] = value;
	exports.store_config_values(filename, data, callback);
};

exports.store_config_values = function(filename, values, callback){
	
	var file = (filename instanceof Array) 
		? path['join'].apply(this, [common.config_path].concat(filename)) + ".js"
		: filename; 
	
	try { 
		var current_values = require(file);
	} catch(e){
		return callback(e);
	}
	
	var replacements = {};

	for(key in values){

		if(!current_values || !current_values.hasOwnProperty(key))
			return callback(new Error("Unexisting key in file " + file + ": " + key));

		var value = values[key];
		var pattern = new RegExp("\t" + key + ":.*,");
		var string_value = (typeof value == 'boolean') ? value.toString() : JSON.stringify(value);
		var new_value = "\t" + key + ": " + string_value + ",";

		// keys on objects must be strings, so we need to store them as from -> to
		replacements[new_value] = pattern; 
		
	}

	exports.replace_in_file(file, replacements, callback);
}

// replacements is an object like {'to': '/from/'}
exports.replace_in_file = function(filename, replacements, callback){

	fs.readFile(filename, function(err, data) {
		if (err) throw err;

		var new_data = data.toString();

		for(to in replacements){
			var pattern = replacements[to];
			new_data = new_data.replace(pattern, to);
		}

		if(data.toString() === new_data)
			return callback();

		try{ eval(new_data) } catch(e){ return callback(new Error("Wrongly formatted value")); }	
		
		// console.log("Filename has changed! Saving data...")
		fs.writeFile(filename, new_data, callback);

	});

};

exports.copy_file = function(src, dest, callback){

	var dest = path.resolve(dest);
	var base_path = path.dirname(dest);

	var pump = function(){
		
		var input = fs.createReadStream(path.resolve(src));
		var output = fs.createWriteStream(dest);

		util.pump(input, output, function(err){
		
			if(err) return callback(err);
			logger.info('Copied ' + path.basename(src)  + ' to ' + dest);
			input.destroy() && output.destroy();
			callback();

		});

	};
	
	var check_path_existance = function(path){

		path.exists(path, function(exists){

			if(exists) return pump();

			console.log("Creating directory: " + path);
			fs.mkdir(path, function(err){
				if(err) return callback(err);
				pump();
			})

		});
	
	}

	path.exists(dest, function(exists){
		if(exists) return callback(new Error("Destination file exists: " + dest));
		check_path_existance(base_path);
	})

};
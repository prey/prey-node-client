var fs = require('fs'),
		path = require('path'),
		exec = require('child_process').exec;

var launchdaemons_path = '/Library/LaunchDaemons';
var launchd_plist = 'com.prey.trigger.plist';
var trigger_script = 'prey-trigger.py';
var prey_bin = exports.prey_bin = '/usr/local/bin/prey';

var trigger_script_path = path.resolve(__dirname + '/' + trigger_script);
var launchd_plist_path = launchdaemons_path + '/' + launchd_plist;

//////////////////////////////////////////////////////
// helper functions
//////////////////////////////////////////////////////

var copy_plist = function(callback){
	var plist = fs.readFileSync(__dirname + '/' + launchd_plist);
	var data = plist.toString() 
		.replace('{{trigger_script}}', trigger_script_path)
		.replace('{{prey_bin}}', prey_bin);

	if(data === plist.toString())
		return callback(new Error("Unable to replace variables in plist template!"))
	
	fs.writeFile(launchd_plist_path, data, callback);
};

var load_plist = function(callback){
	call_launchctl('load', callback);
};

var unload_plist = function(callback){
	call_launchctl('unload', callback);
}

var remove_plist = function(callback){
	fs.unlink(launchd_plist_path, callback);
}

var call_launchctl = function(command, callback){
	exec('launchctl ' + command + ' ' + launchd_plist_path, function(err, stdout, stderr){
		if(stdout.length > 0) console.log(stdout.toString());
		callback(err);
	})	
}

//////////////////////////////////////////////////////
// the actual hooks
//////////////////////////////////////////////////////

exports.post_install = function(callback){

	console.log('Setting up launchd script...');

	path.exists(launchd_plist_path, function(exists){

		if(exists){
			console.log("LaunchDaemon plist file already exists. Skipping...");
			return callback();
		}
		
		copy_plist(function(err){
			if(err) return callback(err);
			
			console.log("Plist file in place. Loading it...");
			load_plist(function(err){
				callback(err);
				
			})

		})

	})

}

exports.pre_uninstall = function(callback){

	console.log('Removing launchd script...');
	path.exists(launchd_plist_path, function(exists){

		if(!exists){
			console.log("LaunchDaemon plist file already removed. Skipping...");
			return callback();
		}

		unload_plist(function(err){
			if(err) return callback(err);

			console.log("Prey trigger unloaded. Removing plist...");
			remove_plist(function(err){
				callback(err);
				
			})

		})

	})}

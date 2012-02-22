exports.post_install = function(callback){
	console.log('Setting up launchd script...');
	callback();
}

exports.pre_uninstall = function(callback){
	console.log('Removing launchd script...');
	callback();
}

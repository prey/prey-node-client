var logger = require('./common').logger,
		http_client = require('needle'),
		exec = require('child_process').exec,
		package_name = 'prey',
		url = 'https://registry.npmjs.org/' + package_name;

exports.get_latest_version = function(callback){

	http_client.get(url, function(err, resp, body){

		if(err) return callback(err);

		var latest_release = body['dist-tags'].latest;
		callback(null, latest_release);

	});

};

exports.update_client = function(version, callback){

	exec('npm update -g ' + package_name, callback);

}

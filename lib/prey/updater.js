var logger = require('./common').logger,
		client = require('needle'),
		// npm = require('npm'),
		package_name = 'prey',
		url = 'https://registry.npmjs.org/' + package_name;

exports.get_latest_version = function(callback){

	require('needle').get(url, function(err, resp, body){

		if(err) return callback(err);

		var latest_release = body['dist-tags'].latest;
		callback(null, latest_release);

	});

};

exports.update_client = function(version, callback){

	return callback(new Error("Unable to update."));

	var npm_opts = {loglevel: 'silent'};

	npm.load({}, function(err){

		if(err) return callback(err);

		npm.commands.update([package_name], function(e, data){

			console.log(data);
			if(e) return callback(e);
			callback(null, version);

		});

	});

	/*
	npm.on('log', function(message){
		console.log(message);
	})
	*/

}

var common = require('./common'),
		logger = common.logger,
		http_client = require('needle'),
		exec = require('child_process').exec;

var package_name = 'prey',
		url = 'https://registry.npmjs.org/' + package_name;

var Updater = module.exports = {

	check: function(callback){

		var self = this;
		logger.info("[updater] Checking for updates...");

		this.get_latest_version(function(err, version){

			if(err || !version)
				return callback(err || new Error("Unable to retrieve client version."));

			logger.info("[updater] Latest Prey version in repository: " + version);

			if(!common.helpers.is_greater_than(version, common.version))
				return callback();

			logger.warn("[updater] New version found! Updating client...");

			self.update_client(version, function(err, stdout, stderr){

				logger.debug(stdout.toString());

				if(err) return callback(err);
				else callback(null, version);

			});

		})

	},

	get_latest_version: function(callback){

		http_client.get(url, function(err, resp, body){

			if(err) return callback(err);

			var latest_release = body['dist-tags'].latest;
			callback(null, latest_release);

		});

	},

	update_client: function(version, callback){

		exec('npm update -g ' + package_name, callback);

	}

}

var wol = require('wake_on_lan');

var wake = exports.start = function(options, callback){

	var mac = options.target_mac.replace('-', ':') // replace just in case

	wol.wake(mac, function(error){

		logger.info(!error ? "Great success!" : "No success.")
		callback(error);

	});

};

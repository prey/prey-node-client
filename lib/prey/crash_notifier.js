var host = require('./constants').crash_reports_url,
    client = require('needle');

exports.send = function(err){

	var data = err;

	client.post(host, data, function(err, response, body){

		console.log("Got status code: " + response.statusCode);

	});

};

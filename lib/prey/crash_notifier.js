var client = require('needle');

var host = 'http://backtraces.preyproject.com/';

exports.send = function(err){

	var data = err;

	client.post(host, data, function(err, response, body){

		console.log("Got status code: " + response.statusCode);

	});

};

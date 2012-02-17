var client = require('needle'),
		host = 'http://exceptions.preyproject.com',
		version = require('common').version;

exports.send = function(err){

	var data = {
		timestamp: new Date().toUTCString(),
		code: err.code,
		message: err.message,
		stack_trace: err.stack,
		client_version: version,
		node_version: process.version 
	}

	client.post(host, data, function(err, response, body){

		if(err) console.log("Got error:" + err);
		else console.log(body);

	});

};

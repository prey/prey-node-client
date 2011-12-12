var host = require('./constants').crash_reports_url,
    client = require('needle');

exports.send = function(err){

	var data = {
		timestamp: new Date().toUTCString(),
		code: err.code,
		message: err.message,
		stack_trace: err.stack
	}

	client.post(host, data, function(err, response, body){

		if(err) console.log("Got error:" + err);
		else console.log(body);

	});

};

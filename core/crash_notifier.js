var http = require('http');

exports.send = function(err){

	var data = err;

	http.request(host, data, function(req, res){

		console.log('Sent!');

	});

};

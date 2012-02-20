var http_transport = require('./../http');

exports.send = function(image, options, callback){
			
	// var config = options;
	var url = 'http://imgur.com/api/upload.xml';
	
	var data = {
		key: options.api_key || module.exports.config.api_key,
		image: image
	}
	
	return http_transport.send(data, {url: url}, callback);
}

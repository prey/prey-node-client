var http_transport = require('./../http');

exports.send = function(image, options){
			
	var config = options;
	var url = 'http://imgur.com/api/upload.xml';
	
	var data = {
		key: config.api_key,
		image: image
	}
	
	return http_transport.send(data, {url: url});
}

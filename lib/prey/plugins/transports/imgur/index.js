var http_transport = require('./http');

exports.send = function(image, options){
	
	var config = module.exports.config;
	
	var opts = options || {};
	opts.url = 'http://imgur.com/api/upload.xml'
	
	var data = {
		key: config.api_key,
		image: image
	}
	
	return http_transport.send(data, opts);
}

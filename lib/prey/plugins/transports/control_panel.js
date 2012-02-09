var common = require('./../../common'),
		http_transport = require('./http');

exports.send = function(data, options){
	var opts = options;
	opts.username = common.config.api_key;
	opts.password = 'x';
	if(!opts.url) opts.url = common.device.url;
	return http_transport.send(data, opts);
}

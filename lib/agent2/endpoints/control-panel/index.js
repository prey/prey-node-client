var needle = require('needle'),
    common = require('./../../common'),
    keys   = require('./../../keys');

var request_format = '.json';

var has_files = function(data) {
  for (var key in data) {
    if (data[key].file && data[key].content_type)
      return true;
  }
};

var get_url = function(what) {
  var host = config.get('protocol') + '://' + config.get('host'),
      path = '/api/v2/devices/' + config.get('device_key');

  return host + path + '/' + what + request_format;
};

exports.init = function(cb) {
  keys.verify(cb);
}

exports.send = function(what, data, opts, callback) {

  var url  = get_url(what),
      opts = opts || {};

  var request_opts = {
    user_agent : common.user_agent,
    multipart  : has_files(data),
    timeout    : 20000,
    proxy      : opts.proxy
  };

  // if proxy url has been set, pass it in options
  if (config.get('try_proxy'))
    opts.proxy = config.get('try_proxy');

  var host = this.url.replace(/.*\/\/([^\/]+).*/, '$1');
  this.log('Posting data to ' + host);

  needle.post(url, data, request_opts, function(err, response, body){

    // if there was an error, lets try connecting via a proxy if possible
    if (err && config.get('try_proxy') != '' && !opts.proxy)
      return send(what, data, { proxy: config.get('try_proxy') }, callback);

    callback(err, response);
  });

};

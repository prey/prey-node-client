var needle    = require('needle'),
    common    = require('./../../common'),
    providers = require('./../../providers'),
    keys      = require('./../../keys'),
    config    = common.config,
    logger    = common.logger.prefix('control-panel');

var request_format = '.json';

var has_files = function(data) {
  for (var key in data) {
    if (data[key] && data[key].file && data[key].content_type)
      return true;
  }
};

var get_url = function(what) {
  var host = config.get('protocol') + '://' + config.get('host'),
      path = '/api/v2/devices/' + config.get('device_key');

  return host + path + '/' + what + request_format;
};

var get_status_info = function(cb) {
  var headers = {};

  providers.get('status', function(err, data){
    if (err) return cb(err);

    headers['X-Prey-Status'] = JSON.stringify(data);
    cb(null, headers);
  })
}

var make_request = function(what, data, opts, callback) {

  var url  = get_url(what),
      opts = opts || {};

  var request_opts = {
    username   : config.get('api_key'),
    password   : 'x',
    multipart  : has_files(data),
    timeout    : 20000,
    proxy      : opts.proxy
  };

  if (opts.headers)
    request_opts.headers = opts.headers;

  var host = url.replace(/.*\/\/([^\/]+).*/, '$1'),
      msg  = 'Posting data to ' + host;
  
  if (opts.proxy) msg += ' using proxy: ' + opts.proxy;
  logger.info(msg);

  needle.post(url, data, request_opts, function(err, resp, body){

    // if there was an error, lets try connecting via a proxy if possible
    if (err && !opts.proxy && config.get('try_proxy') && config.get('try_proxy').match('.')) {
      return make_request(what, data, { proxy: config.get('try_proxy') }, callback);      
    }

    if (resp) resp.body = body;
    callback(err, resp);
  });

};

exports.init = function(cb) {
  keys.verify(cb);
}

exports.send = function(what, data, opts, callback) {
  if (!config.get('send_status_info'))
    return make_request(what, data, opts, callback);

  get_status_info(function(err, headers){
    if (!err && headers)
      opts.headers = headers;

    make_request(what, data, opts, callback);
  })
};

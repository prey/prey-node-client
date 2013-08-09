var common    = require('./../../common'),
    config   = common.config,
    providers = require('./../../providers'),
    logger    = common.logger.prefix('control-panel');

var has_files = function(data) {
  for (var key in data) {
    if (data[key] && data[key].file && data[key].content_type)
      return true;
  }
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

  var opts = opts || {};

  var request_opts = {
    multipart  : has_files(data),
    proxy      : opts.proxy
  };

  if (opts.headers)
    request_opts.headers = opts.headers;

  var host = url.replace(/.*\/\/([^\/]+).*/, '$1'),
      msg  = 'Posting data to ' + host;

  if (opts.proxy) msg += ' using proxy: ' + opts.proxy;
  logger.info(msg);

  api.push[what](data, request_opts, function(err, resp, body){
    // if there was an error, lets try connecting via a proxy if possible
    if (err && !opts.proxy && config.get('try_proxy') && config.get('try_proxy').match('.')) {
      return make_request(what, data, { proxy: config.get('try_proxy') }, callback);
    }

    callback(err, resp);
  });

};

exports.init = function(cb) {
  common.setup(common, cb);
}

exports.send = function(what, data, opts, callback) {
  if (!config.get('send_status_info') || what == 'response')
    return make_request(what, data, opts, callback);

  get_status_info(function(err, headers){
    if (!err && headers)
      opts.headers = headers;

    make_request(what, data, opts, callback);
  })
};

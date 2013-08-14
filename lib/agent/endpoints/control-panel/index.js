var common    = require('./../../common'),
    api       = common.api,
    config    = common.config,
    providers = require('./../../providers'),
    logger    = common.logger.prefix('control-panel');

var has_files = function(data) {
  for (var key in data) {
    if (data[key] && data[key].file && data[key].content_type)
      return true;
  }
};

var get_status_info = function(cb) {
  providers.get('status', cb)
}

var make_request = function(what, data, opts, callback) {

  var opts = opts || {};
  opts.multipart = has_files(data);

  var msg  = 'Posting ' + what;
  if (opts.proxy) msg += ' using proxy: ' + opts.proxy;
  logger.info(msg);

  api.push[what](data, opts, function(err, resp, body){

    // if there was an error, lets try connecting via a proxy if possible
    if (err && !opts.proxy && config.get('try_proxy') && config.get('try_proxy').match('.')) {
      opts.proxy = config.get('try_proxy');
      return make_request(what, data, opts, callback);
    }

    callback(err, resp);
  });

};

exports.init = function(cb) {
  var err = !api.keys.present() && new Error('Keys not present');
  cb(err);
}

exports.send = function(what, data, opts, callback) {
  if (!config.get('send_status_info') || what == 'response')
    return make_request(what, data, opts, callback);

  get_status_info(function(err, status){
    opts.status = status;
    make_request(what, data, opts, callback);
  })
};

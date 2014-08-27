var api = require('./api'),
    bus = require('./bus');

var logger,
    providers,
    try_proxy,
    send_status_info = false;

var get_status_info = function(cb) {
  providers.get('status', cb)
}

var make_request = function(what, data, opts, cb) {
  var opts = opts || {},
      what = what.replace(/s$/, '');

  opts.multipart = what == 'report';

  var msg  = 'Posting ' + what;
  if (opts.proxy) msg += ' using proxy: ' + opts.proxy;
  logger.info(msg);

  api.push[what](data, opts, function(err, resp) {

    // if there was an error, lets try connecting via a proxy if possible
    if (err && !opts.proxy && (try_proxy || '').match('.')) {
      opts.proxy = try_proxy;
      return make_request(what, data, opts, callback);
    }

    bus.emit('response', what, err, resp);
    cb && cb(err, resp);
  });
};

var send = function(what, data, opts, callback) {
  var opts = opts || {};

  if (!send_status_info || what == 'response')
    return make_request(what, data, opts, callback);

  var done = function(err, resp) {
    if (err) {
      var str = 'Got error: ' + err.message;
    } else {
      var str = 'Got status ' + resp.statusCode + ' from server: ' + resp.body.toString(); 
    }

    logger.info(str);
  }

  get_status_info(function(err, status) {
    opts.status = status;
    make_request(what, data, opts, done);
  })
};

//////////////////////////////////////////////////////////////////////
// exports

exports.init = function(common) {
  logger    = common.logger;
  providers = common.providers;

  try_proxy = common.config.global && common.config.global.get('try_proxy');
  send_status_info = common.config.get('send_status_info');
}

exports.notify_action = function(status, name, err) {
  var body = {
    command: 'start',
    target: name,
    status: status
  }
  if (err) body.reason = err.message;
  send('response', body);
}

exports.notify_event = function(name, data){
  var body = {
    name: name,
    info: data
  }
  send('events', body);
}

exports.send_data = function(name, data) {
  var body = {};
  body[name] = data;
  send('data', body);
}

exports.send_report = function(name, data) {
  send('reports', data);
}

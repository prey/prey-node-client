var api = require('./api'),
    bus = require('./bus');

var logger,
    providers,
    send_status_info = false;

var get_status_info = function(cb) {
  providers.get('status', cb)
}

var make_request = function(what, data, opts, cb) {
  var opts = opts || {},
      what = what.replace(/s$/, '');

  opts.multipart = what == 'report';
  logger.info('Posting ' + what);

  api.push[what](data, opts, function(err, resp) {
    bus.emit('response', what, err, resp);
    cb && cb(err, resp);
  });
};

var send = function(what, data, opts, cb) {
  var opts = opts || {};

  var done = function(err, resp) {
    var str = err ? 'Got error: ' + err.message : 'Got ' + resp.statusCode + ' response: ' + resp.body;
    logger.info(str);
    cb && cb(err, resp);
  }

  if (!send_status_info || what == 'response')
    return make_request(what, data, opts, done);

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

  // TODO: we might retrieve these values when needed, instead of on boot
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
  if (name == 'missing' || name == 'stolen')
    return send('reports', data);

  exports.send_data(name, data);
}

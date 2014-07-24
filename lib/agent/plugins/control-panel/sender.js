var api = require('./api');

var agent,
    try_proxy,
    send_status_info = false;

var get_status_info = function(cb) {
  agent.providers.get('status', cb)
}

var make_request = function(what, data, opts, callback) {

  var opts = opts || {},
      what = what.replace(/s$/, '');

  opts.multipart = what == 'report';

  var msg  = 'Posting ' + what;
  if (opts.proxy) msg += ' using proxy: ' + opts.proxy;
  agent.logger.info(msg);

  api.push[what](data, opts, function(err, resp, body){

    // if there was an error, lets try connecting via a proxy if possible
    if (err && !opts.proxy && (config.get('try_proxy') || '').match('.')) {
      opts.proxy = config.get('try_proxy');
      return make_request(what, data, opts, callback);
    }

    callback(err, resp);
  });

};

var send = function(what, data, opts, callback) {
  var opts = opts || {};

  if (!send_status_info || what == 'response')
    return make_request(what, data, opts, callback);

  var done = function(err, resp) {
    var str = resp.body && resp.body.length > 0 ? resp.body.toString() : resp.statusCode;
    agent.logger.info('Response from server: ' + str);
    agent.hooks.emit('response', what, resp);
  }

  get_status_info(function(err, status) {
    opts.status = status;
    make_request(what, data, opts, done);
  })
};

//////////////////////////////////////////////////////////////////////
// exports

exports.init = function(common) {
  agent     = common;
  try_proxy = agent.config.global.get('try_proxy');
  send_status_info = agent.config.get('send_status_info');
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

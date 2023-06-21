var api = require('./api'),
  bus = require('./bus'),
  status_trigger = require('../triggers/status');

var logger,
  send_status_info = false;

var get_status_info = (cb) => {
  status_trigger.get_status(cb);
};

var make_request = function (what, data, opts, cb) {
  var opts = opts || {},
    what = what.replace(/s$/, '');

  opts.multipart = what == 'report';
  logger.info('Posting ' + what);

  api.push.methods[what](data, opts, function (err, resp) {
    if (resp && data.messageID) {
      resp.headers['X-Prey-Correlation-ID'] = data.messageID;
      resp.headers['X-Prey-Device-ID'] = api.keys.get().device;
      resp.headers['X-Prey-State'] = 'PROCESSED';
    }
    bus.emit('response', what, err, resp);
    cb && cb(err, resp);
  });
};

var send = function (what, data, opts, cb) {
  var opts = opts || {};

  var done = function (err, resp) {
    var str = err
      ? 'Got error: ' + err.message
      : 'Got ' + resp.statusCode + ' response: ' + resp.body;
    logger.info(str);
    cb && cb(err, resp);
  };

  if (!send_status_info || what == 'response')
    return make_request(what, data, opts, done);

  get_status_info((err, status) => {
    opts.status = status;
    make_request(what, data, opts, done);
  });
};

//////////////////////////////////////////////////////////////////////
// exports

exports.init = function (common) {
  logger = common.logger.prefix('sender');

  // TODO: we might retrieve these values when needed, instead of on boot
  send_status_info = common.config.get('send_status_info');
};

exports.notify_action = function (status, id, name, opts, err, out) {
  if (name === 'geofencing' || name === 'triggers') return; // geofencing and triggers needs to send custom notification

  var body = {
    command: 'start',
    target: name,
    status: status,
  };

  if (opts) {
    if (opts.messageID) body.messageID = opts.messageID;
    if (opts.device_job_id) {
      var job_id = { device_job_id: opts.device_job_id };
      body.reason = JSON.stringify(job_id);
    }
    if (opts.trigger_id) {
      var trigger_id = { trigger_id: opts.trigger_id };
      body.reason = JSON.stringify(trigger_id);
    }
  }

  if (out && name == 'diskencryption') body.reason = { encryption: out };
  if (out && name == 'factoryreset')
    body.reason = { status_code: out.data, status_msg: out.message };
  if (out && name == 'fullwipe')
    body.reason = { status_code: out.data, status_msg: out.message };

  if (err) body.reason = err.message;
  if (err && name == 'factoryreset') {
    body.reason = {
      status_code: err.code ? err.code : 1,
      status_msg: err.message,
    };
    body.status = 'stopped';
  }

  if (name == 'fullwipe' || name == 'fullwipewindows') {
    if (err)
      body = {
        command: body.command,
        status: 'stopped',
        reason: {
          status_code: err.code ? err.code : 1,
          status_msg: err.message,
        },
      };
    body.target = opts.target;
  }
  send('response', body);
};

exports.notify_event = function (name, data) {
  var body = {
    name: name,
    info: data,
  };
  send('events', body);
};

exports.send_data = function (name, data) {
  var body = {};
  body[name] = data;
  send('data', body);
};

exports.send_report = function (name, data) {
  if (name == 'missing' || name == 'stolen') return send('reports', data);

  exports.send_data(name, data);
};

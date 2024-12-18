const api = require('./api');
const bus = require('./bus');
const status_trigger = require('../triggers/status');
const config = require('../../utils/configfile');

let logger;
let send_status_info = false;

const get_status_info = (cb) => {
  status_trigger.get_status(cb);
};

const make_request = function (what, data, opts, cb) {
  var opts = opts || {};
  var what = what.replace(/s$/, '');

  opts.multipart = what == 'report';
  logger.info(`Posting ${what}`);

  api.push.methods[what](data, opts, (err, resp) => {
    if (resp && data.messageID) {
      resp.headers['X-Prey-Correlation-ID'] = data.messageID;
      resp.headers['X-Prey-Device-ID'] = api.keys.get().device;
      resp.headers['X-Prey-State'] = 'PROCESSED';
    }
    bus.emit('response', what, err, resp);
    cb && cb(err, resp);
  });
};

const send = function (what, data, opts, cb) {
  var opts = opts || {};

  const done = function (err, resp) {
    const str = err ? `Got error: ${err.message}` : `Got ${resp.statusCode} response: ${resp.body}`;
    logger.info(str);
    cb && cb(err, resp);
  };

  if (!send_status_info || what == 'response') { return make_request(what, data, opts, done); }

  get_status_info((err, status) => {
    opts.status = status;
    make_request(what, data, opts, done);
  });
};

/// ///////////////////////////////////////////////////////////////////
// exports

exports.init = function (common) {
  logger = common.logger;

  // TODO: we might retrieve these values when needed, instead of on boot
  send_status_info = config.getData('control-panel.send_status_info');
};

exports.notify_action = function (status, id, name, opts, err, out) {
  if (name === 'triggers') return; // triggers needs to send custom notification

  let body = {
    command: 'start',
    target: name,
    status,
  };

  if (opts) {
    if (opts.messageID) body.messageID = opts.messageID;
    if (opts.device_job_id) {
      const job_id = { device_job_id: opts.device_job_id };
      body.reason = JSON.stringify(job_id);
    }
    if (opts.trigger_id) {
      const trigger_id = { trigger_id: opts.trigger_id };
      body.reason = JSON.stringify(trigger_id);
    }
  }

  if (out && name == 'diskencryption') body.reason = { encryption: out };
  if (out && name == 'factoryreset') body.reason = { status_code: out.data, status_msg: out.message };
  if (out && name == 'fullwipe') body.reason = { status_code: out.data, status_msg: out.message };

  if (err) body.reason = err.message;
  if (err && (name == 'factoryreset')) { body.reason = { status_code: (err.code) ? err.code : 1, status_msg: err.message }; body.status = 'stopped'; }

  if (name == 'fullwipe' || name == 'fullwipewindows') {
    if (err) body = { command: body.command, status: 'stopped', reason: { status_code: (err.code) ? err.code : 1, status_msg: err.message } };
    body.target = opts.target;
  }
  send('response', body);
};

exports.notify_event = function (name, data) {
  const body = {
    name,
    info: data,
  };
  send('events', body);
};

exports.send_data = function (name, data) {
  const body = {};
  body[name] = data;
  send('data', body);
};

exports.send_report = function (name, data) {
  if (name == 'missing' || name == 'stolen') { return send('reports', data); }

  exports.send_data(name, data);
};

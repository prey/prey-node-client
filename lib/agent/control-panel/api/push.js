const keys = require('./keys');
const errors = require('./errors');
const request = require('./request');
const common = require('../../../common');

const checkKeys = () => {
  if (!keys.present()) throw errors.get('MISSING_KEY');
};

exports.post = (url, data, opts, cb) => {
  const options = opts;
  if (options && typeof (options) === 'object' && options?.status) {
    const stats = JSON.stringify(options.status);
    options.headers = { 'X-Prey-Status': stats };
    delete options.status;
  }
  if (options && typeof (options) === 'object' && !options?.user_agent) options.user_agent = common.system.user_agent;

  request.post(url, data, options, cb);
};

exports.formatUrl = (endpoint) => {
  const format = '.json';
  const resp = `/devices/${keys.get().device}/${endpoint}${format}`;
  return resp;
};

exports.response = (data, opts, cb) => {
  checkKeys();
  const url = exports.formatUrl('response');
  exports.post(url, data, opts, cb);
};

exports.event = (data, opts, cb) => {
  checkKeys();
  const url = exports.formatUrl('events');
  exports.post(url, data, opts, cb);
};

exports.report = (data, opts, cb) => {
  checkKeys();
  const url = exports.formatUrl('reports');
  exports.post(url, data, opts, cb);
};

exports.data = (dta, opts, cb) => {
  checkKeys();
  const url = exports.formatUrl('data');
  exports.post(url, dta, opts, cb);
};

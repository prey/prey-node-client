const keys = require('./keys');
const errors = require('./errors');
const request = require('./request');
const common = require('../../../common');

const checkKeys = () => {
  if (!keys.present()) throw errors.get('MISSING_KEY');
};

const post = (url, data, opts, cb) => {
  const options = opts;
  if (options?.status) {
    const stats = JSON.stringify(options.status);
    options.headers = { 'X-Prey-Status': stats };
    delete options.status;
  }
  if (!options?.user_agent) options.user_agent = common.system.user_agent;

  request.post(url, data, options, cb);
};

const formatUrl = (endpoint) => {
  const format = '.json';
  const resp = `/devices/${keys.get().device}/${endpoint}${format}`;
  return resp;
};

const response = (data, opts, cb) => {
  checkKeys();
  const url = formatUrl('response');
  post(url, data, opts, cb);
};

const event = (data, opts, cb) => {
  checkKeys();
  const url = formatUrl('events');
  post(url, data, opts, cb);
};

const report = (data, opts, cb) => {
  checkKeys();
  const url = formatUrl('reports');
  post(url, data, opts, cb);
};

const data = (dta, opts, cb) => {
  checkKeys();
  const url = formatUrl('data');
  post(url, dta, opts, cb);
};

exports.methods = {
  report, data, event, response,
};

exports.report = report;
exports.data = data;
exports.event = event;
exports.response = response;

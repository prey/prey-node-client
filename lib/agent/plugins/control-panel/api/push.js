var keys    = require('./keys'),
    errors  = require('./errors'),
    request = require('./request'),
    common  = require('./../../../common');

var check_keys = function() {
  if (!keys.present())
    throw errors.get('MISSING_KEY');
}

var post = function(url, data, opts, cb) {
  var opts = opts || {};

  if (opts.status) {
    var stats = JSON.stringify(opts.status);
    opts.headers = { 'X-Prey-Status': stats };
    delete opts['status'];
  }
  if (!opts.user_agent)
    opts.user_agent = common.system.user_agent;

  request.post(url, data, opts, cb)
}

const response = function(data, opts, cb) {
  check_keys();
  var url = format_url('response');
  post(url, data, opts, cb);
}

const event = function(data, opts, cb) {
  check_keys();
  var url = format_url('events');
  post(url, data, opts, cb);
}

const data = function(data, opts, cb) {
  check_keys();
  var url = format_url('data');
  post(url, data, opts, cb);
}

const report = function(data, opts, cb) {
  check_keys();
  var url = format_url('reports');
  post(url, data, opts, cb);
}

function format_url(endpoint) {
  var format  = '.json';
  return '/devices/' + keys.get().device + '/' + endpoint + format;
}

exports.methods = {report, data, event, response};
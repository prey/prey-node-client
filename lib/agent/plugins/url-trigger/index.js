var timer,
    client,
    logger,
    commands,
    opts = {};

var defaults = {
  code: 404,
  interval: 30
}

var request_opts = {
  timeout: 20000
}

///////////////
//

function start_checking() {
  timer = setInterval(check, opts.check_every * 1000);
}

function check() {
  client.get(opts.url, request_opts, function(err, resp) {
    if (resp && resp.statusCode == opts.code) {
      logger.warn('Holy macaroni! Got status code ' + resp.statusCode);
      commands.run('get', 'report', { interval: opts.report_every });
    }
  })
}

function stop_checking() {
  if (timer) clearInterval(timer);
}

exports.enabled = function(cb) {

  // validate that the URL's current status code is different from the one in config
  var client = this.transports.http,
      url    = this.config.get('check_url'),
      code   = this.config.get('missing_code');

  client.get(url, request_opts, function(err, resp) {
    if (err || !resp.statusCode)
      return cb(err || new Error('Invalid status code received.'));

    console.log('Got status code: ' + resp.statusCode);
    var err = resp.statusCode == code ? new Error('URL is already giving a ' + code + ' status code!') : null;
    cb(err);
  })
}

exports.load = function(cb) {

  var agent = this;
  logger    = agent.logger;
  commands  = agent.commands;
  client    = agent.transports.http;

  opts.url          = agent.config.get('check_url');
  opts.code         = agent.config.get('missing_code') || defaults.code;
  opts.check_every  = agent.config.get('check_interval') || defaults.interval;
  opts.report_every = agent.config.get('reports_interval') || defaults.interval;

  if (agent.config.get('http_user'))
    request_opts.username = this.config.get('http_user');

  if (agent.config.get('http_pass'))
    request_opts.password = agent.config.get('http_pass');

  if (!opts.url)
    return cb(new Error('No URL to check!'));

  // set interval checks
  start_checking();

  // whenever reconnected, check
  agent.hooks.on('connected', check);

  // and check now
  check();
}

exports.unload = function() {
  stop_checking();
}

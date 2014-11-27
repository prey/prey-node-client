var opts,
    timer,
    client,
    default_interval = 30;

var request_opts = {
  timeout: 20000
}

///////////////
//

function start_checking() {
  timer = setInterval(opts.check_every, interval * 1000);
}

function check() {
  client.get(opts.url, request_opts, function(err, resp) {
    if (resp && resp.statusCode == opts.code)
      commands.trigger('get', 'reports', { interval: opts.report_every });
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

  client.get(url, function(err, resp) {
    if (err || !resp.statusCode)
      return cb(err || new Error('Invalid status code received.'));

    console.log('Got status code: ' + resp.statusCode);
    var err = resp.statusCode == code ? new Error('URL is already giving a ' + code + ' status code!') : null;
    cb(err);
  })
}

exports.load = function(cb) {

  client = this.transports.http;

  opts.url          = this.config.get('check_url');
  opts.code         = this.config.get('missing_code');
  opts.check_every  = this.config.get('check_interval') || default_interval;
  opts.report_every = this.config.get('reports_interval') || default_interval;

  if (this.config.get('http_user'))
    request_opts.username = this.config.get('http_user');

  if (this.config.get('http_pass'))
    request_opts.password = this.config.get('http_pass');

  if (!opts.url)
    return cb(new Error('No URL to check!'));

  start_checking();
}

exports.unload = function() {
  stop_checking();
}

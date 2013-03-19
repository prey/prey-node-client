"use strict";

var common      = require('./../common'),
    inspect     = require('util').inspect,
    config      = common.config,
    user_agent  = common.user_agent,
    http_client = require('needle');

var base_opts = { follow: false, user_agent: user_agent };

/**
 * @api  public
 */
exports.authorize = function (args, cb) {
  log('Authenticating...');
  var host = get_host();
  if (!host) return cb(new Error('Control Panel host not set!'));

  var url = 'https://' + host + '/profile.xml',
      opts = base_opts;

  // opts.parse = false;
  opts.username = args.email || args.api_key;
  opts.password = args.password || 'x';

  http_client.get(url, opts, function(err, resp, body){
    if (err) return cb(err);

    if (resp.statusCode !== 200) {
      cb(new Error("Unexpected status code: " + resp.statusCode));
    } else if (body.user && parseInt(body.user.available_slots) <= 0) {
      cb(new Error("Account is valid, but no available slots are left."));
    } else if (body.user && body.user.key) {
      cb(null, {api_key: body.user.key});
    } else {
      cb(new Error("Unknown error ocurred. Please try again later."));
    }
 });
}

/**
 * @api  public
 */
exports.verify = function (args, cb) {
  if (!args.api_key || !args.device_key)
    return cb(new Error('Both API and Device keys are needed.'));

  var host = get_host();
  if (!host) return cb(new Error('Control Panel host not set!'));

  log('Verifying keys...');
  var url = 'http://' + host + '/devices/' + args.device_key + '.xml',
      opts = base_opts;

  opts.username = args.api_key;
  opts.password = 'x';

  http_client.put(url, '1=1', opts, function(err, resp, body){
    if (err) return cb(err);

    log('Got status code: ' + resp.statusCode);

    if (resp.statusCode === 200)
      cb()
    else if (resp.statusCode === 404)
      cb(new Error('Device not found!'))
    else if (resp.statusCode === 401)
      cb(new Error('Invalid credentials.'))
    else
      cb(new Error(body.toString()))
  })
}

/**
 * @api  public
 */
exports.signup = function (args, cb) {
  var host = get_host();
  if (!host) return cb(new Error('Control Panel host not set!'))

  log('Signing you up...');
  var url = 'https://' + host + '/signup.xml';

  http_client.post(url, args, base_opts, function(err, resp, body){
    if (err) return callback(err);

    if (body && body.user && body.user.key)
      cb(null, {api_key: body.user.key});
    else
      cb(new Error(inspect(body)));
  });
}

/**
 * @api  private
 */
function get_host () {
  return config.get('host');
}

/**
 * @api  private
 */
function log (str) {
  console.log(str);
}

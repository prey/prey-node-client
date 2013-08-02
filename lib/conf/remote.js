"use strict";

var common      = require('./../common'),
    inspect     = require('util').inspect,
    config      = common.config,
    http_client = require('needle');

var get_root = function(){
  var host = config.get('host');
  return host && config.get('protocol') + '://' + host + '/api/v2';
}

var log = function(str){
  console.log(str);
}

var errors = {
  'MISSING_KEY'        : 'Both API and Device keys are needed.',
  'HOST_NOT_SET'       : 'Prey Control Panel host not set!',
  'INVALID_DEVICE_KEY' : 'Device not found in database. Please reconfigure.',
  'INVALID_CREDENTIALS': 'Invalid credentials',
  'NO_AVAILABLE_SLOTS' : 'Account is valid, but no available slots are left.'
}

var kaboom = function(code) {
  if (!errors[code]) return new Error(code);
  var err = new Error(errors[code]);
  err.code = code;
  return err;
}

exports.authorize = function(args, cb){
  log('Authenticating...');

  var root = get_root();
  if (!root) return cb(kaboom('HOST_NOT_SET'));

  var url  = root + '/profile.xml',
      opts = {};

  // opts.parse = false;
  opts.username = args.email || args.api_key;
  opts.password = args.password || 'x';

  http_client.get(url, opts, function(err, resp, body){
    if (err) return cb(err);

    if (resp.statusCode == 401) {
      cb(kaboom('INVALID_CREDENTIALS'))
    } else if (body.user && parseInt(body.user.available_slots) <= 0) {
      cb(kaboom('NO_AVAILABLE_SLOTS'));
    } else if (body.user && body.user.key) {
      cb(null, {api_key: body.user.key});
    } else {
      cb(new Error("Unknown error. Status code: " + resp.statusCode));
    }
 });

}

exports.verify = function(args, cb){
  if (!args.api_key || !args.device_key)
    return cb(kaboom('MISSING_KEY'));

  var root = get_root();
  if (!root) return cb(kaboom('HOST_NOT_SET'));

  log('Verifying keys...');
  var url = root + '/devices/' + args.device_key + '/response.json',
      opts = {};

  opts.username = args.api_key;
  opts.password = 'x';

  http_client.post(url, '1=1', opts, function(err, resp, body){
    if (err) return cb(err);

    log('Got status code: ' + resp.statusCode);

    if (resp.statusCode === 200)
      cb()
    else if (resp.statusCode === 406)
      cb(kaboom('INVALID_DEVICE_KEY'))
    else if (resp.statusCode === 401)
      cb(kaboom('INVALID_CREDENTIALS'))
    else
      cb(new Error(body.toString()))
  })
}

exports.signup = function(args, cb){
  var root = get_root();
  if (!root) return cb(kaboom('HOST_NOT_SET'));

  log('Signing you up...');
  var url = root + '/signup.xml';

  http_client.post(url, args, function(err, resp, body){
    if (err) return callback(err);

    if (body && body.user && body.user.key)
      cb(null, {api_key: body.user.key});
    else
      cb(new Error(inspect(body)));
  });
}

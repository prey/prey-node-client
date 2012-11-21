"use strict";

var common = require('./../common'),
    inspect = require('util').inspect,
    config = common.config,
    user_agent = common.user_agent,
    http_client = require('needle');

var base_opts = { follow: false, user_agent: user_agent };

var get_host = function(){
  config.get('control-panel').host;
}

exports.authorize = function(args, cb){

  var url = 'https://' + get_host() + '/profile.xml';

  var opts = base_opts;
  opts.username = args.email || args.api_key;
  opts.password = args.password || 'x';

  http_client.get(url, opts, function(err, resp, body){
    if (err) return callback(_error(err));

    if (resp.statusCode !== 200){
      cb(_error("Unexpected status code: " + resp.statusCode));
    } else if (body.user && parseInt(body.user.available_slots) <= 0) {
      cb(_error("You've reached the limit! No available slots left."));
    } else if (body.user && body.user.key) {
      cb(null, {api_key: body.user.key});
    } else {
      cb(_error("Unknown error ocurred. Please try again later."));
    }
 });

}

exports.verify = function(args, cb){

  if (!args.api_key || !args.device_key)
    return cb(new Error('Need to pass API and Device keys.'))

  var url = 'http://' + get_host() + '/devices/' + args.device_key + '.xml';

  var opts = base_opts;
  opts.username = args.api_key;
  opts.password = 'x';

  http_client.put(url, '1=1', opts, function(err, resp, body){
    if (err) return cb(err);

    console.log('Got status code ' + resp.statusCode);

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

exports.signup = function(args, cb){

  var url = 'https://' + get_host() + '/signup.xml';

  http_client.post(url, args, base_opts, function(err, resp, body){
    if (err) return callback(_error(err));

    if (body && body.user && body.user.key)
      cb(null, {api_key: body.user.key});
    else
      cb(new Error(inspect(body)));
  });
}

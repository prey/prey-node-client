"use strict";

var common = require('./../common'),
    host = common.config.get('control-panel').host,
    user_agent = common.user_agent,
    http_client = require('needle');

var request_format = '.xml';
var profile_url    = 'https://' + host + '/profile'  + request_format;
var signup_url     = 'https://' + host + '/register' + request_format;

exports.authorize = function(args, cb){

  var opts = { user_agent: user_agent };
  opts.username = args.email || args.api_key;
  opts.password = args.password || 'x';

  http_client.get(profile_url, opts, function(err, resp, body){
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
  console.log(args);
}

exports.signup = function(args, cb){
  var url = signup_url;
  var opts = {user_agent: user_agent};

  http_client.post(url, data, opts, function(err, resp, body){
    if(err) return callback(_error(err));

    if (body && body.key)
      callback(null, {api_key: body.key});
    else
      callback(_error("Unknown response."));
  });
}

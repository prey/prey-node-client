"use strict";

//////////////////////////////////////////
// Prey Register Module
// Written by Tomas Pollak
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = _ns("common"),
    host = common.config.get('control-panel').host,
    user_agent = common.user_agent,
    http_client = require('needle'),
    exp = module.exports;

var request_format = '.xml';
var profile_url    = 'https://' + host + '/profile'  + request_format;
var signup_url     = 'https://' + host + '/register' + request_format;
var new_device_url = 'https://' + host + '/devices'  + request_format;

var get_device_data = function(callback){
  var Hardware = _ns("hardware"),
  System = _ns("system"),
  data = {};

  Hardware.get_firmware_info(function(err, hw_info) {
    if(err) return callback(_error(err));
    
    data.title = hw_info.model_name || "My Computer";
    data.device_type = hw_info.device_type;
    data.vendor_name = hw_info.vendor_name;
    data.model_name  = hw_info.model_name;

    System.get_os_name(function(err, os_name){
      data.os = os_name.replace('LinuxMint','Ubuntu');
      System.get_os_version(function(err, os_version) {
        data.os_version = os_version;
        callback(null,data);
      });
    });
  });
};

exp.validate = function(options, callback){
  var url = profile_url;
  options.headers = {'User-Agent': user_agent};

  http_client.get(url, options, function(err, response, body){
    if (err) return callback(_error(err));

    if (response.statusCode !== 200){
      callback(_error("Unexpected status code: " + response.statusCode));
    } else if (body.user && parseInt(body.user.available_slots) <= 0) {
      callback(_error("You've reached the limit! No available slots left."));
    } else if (body.user && body.user.key) {
      callback(null, {api_key: body.user.key});
    } else {
        callback(_error("Unknown error ocurred. Please try again later."));
      }
    });
};

exp.new_user = function(data, callback){
  var url = signup_url;
  var headers = {'User-Agent': user_agent};

  http_client.post(url, data, {headers: headers}, function(err, response, body){
    if(err) return callback(_error(err));

    if (body && body.key)
      callback(null, {api_key: body.key});
    else
      callback(_error("Unknown response."));
  });
};

exp.new_device = function(options, callback) {

  var request_opts = {
    username: options.api_key,
    password: 'x',
    headers: { 'User-Agent': user_agent }
  };

  get_device_data(function(err, data){
    if(err) return callback(_error(err));

    http_client.post(new_device_url, {device: data}, request_opts, function(err, response, body){
      if (err) return callback(_error(err));

      if (body.device && body.device.key){
        callback(null, {device_key: body.device.key});
      } else if (response.statusCode === 302 || response.headers.location){
        callback(_error("No available slots on account. Support Prey by upgrading to Pro!"));
      } else {
        callback(_error("Unknown response. Could not get device key.",response));
      }
    });
  });
};

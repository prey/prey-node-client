
var common = require('./../../../common'),
    config = common.config,
    system = common.system,
    needle = require('needle'),
    user_agent = common.user_agent,
    providers = common.providers;

var host = config.get('control-panel').host,
    protocol       = 'https://',
    request_format = '.xml',
    attach_url     = protocol + host + '/devices'  + request_format,
    settings_url   = protocol + host + '/settings'

var get_device_data = function(callback){
  var data = {};

  providers.get('firmware_info', function(err, hw_info) {
    if (err) return callback(err);

    data.title = hw_info.model_name || "My Computer";
    data.device_type = hw_info.device_type;
    data.vendor_name = hw_info.vendor_name;
    data.model_name  = hw_info.model_name;

    system.get_os_name(function(err, os_name){
      data.os = os_name.replace('LinuxMint', 'Ubuntu');
      system.get_os_version(function(err, os_version) {
        data.os_version = os_version;
        callback(null, data);
      });
    });
  });
};

var retrieve_settings = function(request_opts, key, cb){

  var data = {device_key: key};

  needle.get(settings_url, request_opts, function(err, resp, body){
    if (!err) data.settings = body.settings;
    cb(null, data);
  })

}

exports.attach = function(options, callback) {

  var request_opts = {
    parse: true,
    username: options.api_key,
    password: 'x',
    user_agent: user_agent
  };

  get_device_data(function(err, data){
    if (err) return callback(err);

    needle.post(attach_url, {device: data}, request_opts, function(err, resp, body){
      if (err) return callback(err);

      if (body.device && body.device.key){
        retrieve_settings(request_opts, body.device.key, callback);
      } else if (resp.statusCode === 302 || resp.headers.location){
        callback(new Error("No available slots on account. Support Prey by upgrading to Pro!"));
      } else if (body.errors && body.errors.error) {
        callback(new Error('Validation error: ' + body.errors.error));
      } else {
        callback(new Error("Unknown response. Could not get device key."));
      }
    });
  });

};


var common = _ns('common'),
    system = common.system,
    needle = require('needle'),
    host = common.config('control-panel').host,
    user_agent = common.user_agent,
    providers = _ns('providers')

var request_format = '.xml',
    endpoint = 'https://' + host + '/devices'  + request_format;

var get_device_data = function(callback){
  var data = {};

  providers.get('firmware_info', function(err, hw_info) {
    if (err) return callback(_error(err));

    data.title = hw_info.model_name || "My Computer";
    data.device_type = hw_info.device_type;
    data.vendor_name = hw_info.vendor_name;
    data.model_name  = hw_info.model_name;

    system.get_os_name(function(err, os_name){
      system.get_os_version(function(err, os_version) {
        data.os_version = os_version;
        callback(null, data);
      });
    });
  });
};

module.exports = function(options, callback) {

  var request_opts = {
    username: options.api_key,
    password: 'x',
    headers: { 'User-Agent': user_agent }
  };

  get_device_data(function(err, data){
    if(err) return callback(_error(err));

    http_client.post(endpoint, {device: data}, request_opts, function(err, resp, body){
      if (err) return callback(_error(err));

      if (body.device && body.device.key){
        callback(null, {device_key: body.device.key});
      } else if (resp.statusCode === 302 || resp.headers.location){
        callback(_error("No available slots on account. Support Prey by upgrading to Pro!"));
      } else {
        callback(_error("Unknown response. Could not get device key.", resp));
      }
    });
  });

};

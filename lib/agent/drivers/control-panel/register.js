
var common = require('./../../../common'),
    config = common.config,
    system = common.system,
    needle = require('needle'),
    user_agent = common.user_agent,
    providers = common.providers;

var host = config.get('control-panel').host,
    request_format = '.xml',
    endpoint = 'https://' + host + '/devices'  + request_format;

var get_device_data = function(callback){

  var data = {},
      count = 3;

  var done = function(err, new_data){
    console.log(new_data);
    if (!err) {
      for (var key in new_data) {
        data[key] = new_data[key];
      }
    }
    --count || callback(err, data);
  }

  providers.get('specs', done);

  system.get_os_name(function(err, name){
    var name = name.replace('LinuxMint', 'Ubuntu');
    done(err, {os: name})
  });

  system.get_os_version(function(err, ver){
    done(err, {os_version: ver})
  });

};

module.exports = function(options, callback) {

  var request_opts = {
    // parse: false,
    username: options.api_key,
    password: 'x',
    headers: { 'User-Agent': user_agent }
  };

  get_device_data(function(err, data){
    if (err) return callback(err);

    needle.post(endpoint, {device: data}, request_opts, function(err, resp, body){
      if (err) return callback(err);

      if (body.device && body.device.key){
        callback(null, {device_key: body.device.key});
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

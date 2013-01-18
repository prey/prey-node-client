
var os = require('os'),
    common = require('./../../../common'),
    config = common.config,
    system = common.system,
    needle = require('needle'),
    user_agent = common.user_agent,
    providers = common.providers;

var host     = config.get('host'),
    protocol = config.get('protocol'),
    endpoint = protocol + '://' + host + '/devices.xml';

var get_device_data = function(callback){

  var e, data = {}, count = 3;

  var done = function(err, new_data){
    if (err) {
      e = err;
    } else {
      for (var key in new_data) {
        data[key] = new_data[key];
      }
    }
    --count || callback(e, data);
  }

  providers.get('specs', function(err, data){
    done(err, {'specs': data});
  });

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

    data.name = os.hostname();
    data.type = data.firmware_info && data.firmware_info.device_type || 'Laptop';

    needle.post(endpoint, {device: data}, request_opts, function(err, resp, body){
      if (err) return callback(err);

      if (body.device && body.device.key){
        callback(null, {device_key: body.device.key});
      } else if (resp.statusCode === 302 || resp.headers.location){
        callback(new Error("No available slots on account. Support Prey by upgrading to Pro!"));
      } else if (body.errors && body.errors.error) {
        callback(new Error('Validation error: ' + body.errors.error));
      } else {
        callback(new Error("Could not get device key. Response code: " + resp.statusCode));
      }
    });
  });

};

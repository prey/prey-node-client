
var common = require('./../../../common'),
    config = common.config,
    system = common.system,
    needle = require('needle'),
    user_agent = common.user_agent,
    providers = common.providers;

var host       = config.get('host'),
    protocol   = config.get('protocol'),
    attach_url = protocol + '://' + host + '/devices.json';

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

  providers.get('specs', done);

  system.get_os_name(function(err, name){
    var name = name.replace('LinuxMint', 'Ubuntu');
    done(err, {os: name})
  });

  system.get_os_version(function(err, ver){
    done(err, {os_version: ver})
  });

};

var retrieve_settings = function(request_opts, key, cb){

  var data = {device_key: key},
      settings_url = protocol + host + '/devices/' + key + '/settings.json';

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

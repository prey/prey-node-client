var os        = require('os'),
    needle    = require('needle'),
    common    = require('./common'),
    providers = require('./providers'),
    system    = common.system,
    config    = common.config,
    logger    = common.logger.prefix('setup');

var linking   = false;

var messages  = {
  no_api_key: 'No API key found. Please run bin/prey config.',
  registering_device: 'Registering device to account...',
  gathering_data: 'Gathering device data...',
  register_success: 'Device succesfully created. Key: ',
  couldnt_register: "Couldn't register this device.",
  no_slots: 'No available slots for devices. Support Prey by upgrading to Pro!',
  validation_error: 'Validation error: ',
  unknown_response: 'Unknown response: '
}

/*
var unlink = function(cb) {
  config.set('api_key', '');
  config.set('device_key', '');
  config.save(cb);
};
*/

var verify = function(cb) {
  var device_key = config.get('device_key'),
      api_key    = config.get('api_key');

  if (!api_key || api_key == '')
    return cb(new Error(messages.no_api_key));

  if (device_key && device_key != '')
    return cb(); // all good.

  if (linking)
    return cb(new Error('Device registration in progress.'));

  config.writable(function(yes){
    if (!yes) return cb(new Error('Config not writable. Cannot setup device.'))

    linking = true;
    link_device(api_key, function(err){
      linking = false;
      cb(err);
    });
  })
};

var link_device = function(api_key, cb){

  logger.info(messages.registering_device)
  get_device_data(function(err, data){
    if (err) return cb(err);

    data.name = os.hostname();
    data.type = data.firmware_info && data.firmware_info.device_type || 'Laptop';

    send_request(api_key, data, function(err, device_key){
      if (err || !device_key)
        return cb(err || new Error(messages.couldnt_register));

      logger.notice(messages.register_success + device_key);
      config.update('device_key', device_key, cb);
    })
  });

};

var send_request = function(api_key, data, cb) {

  var opts = {
    parse: true,
    username: api_key,
    password: 'x',
    user_agent: common.user_agent
  };

  var host       = config.get('host'),
      protocol   = config.get('protocol'),
      attach_url = protocol + '://' + host + '/devices.json';

  needle.post(attach_url, { device: data }, opts, function(err, resp, body){
    if (err) return cb(err);

    if (body && body.key) {
      cb(null, body.key)
    } else if (resp.statusCode === 302 || resp.statusCode == 401) {
      cb(new Error(messages.no_slots));
    } else if (body.errors && body.errors.error) {
      cb(new Error(messages.validation_error + body.errors.error));
    } else {
      cb(new Error(messages.unknown_response + body.toString()));
    }
  });

};

var get_device_data = function(callback){

  logger.info(messages.gathering_data);
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

exports.verify = verify;

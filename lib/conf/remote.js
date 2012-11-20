/**
 * From command line params, email,user_password and name, register a user.
 * Make sure required params array are values are indexed in order.
 **/
var signup = function(callback) {
  var register = _ns('register');
  _tr("Signing up user...");

  var req_params = required(['user_name','email','user_password']);

  if (!req_params.values) {
    return callback(_error('signup: The following fields are required:',inspect(req_params.missing)));
  }

  var prms = req_params.values,
      packet = {
        user: {
          name: prms[0],
          email: prms[1],
          password: prms[2],
          password_confirmation: prms[2]
        }
      };

  register.new_user(packet, function(err, data){
    if (err) return callback(_error(err));

    callback(null);
  });
};

/**
 * From command line params, email,user_password make sure we have a valid user.
 * Then saves the returned api_key to config.
 * Callsback the api_key.
 **/
var validate_user = function(callback) {
  var register = _ns('register');

  _tr("Validating user...");

  var req_params = required(['email','user_password']);

  if (!req_params.values) {
    return callback(_error('validate_user: The following fields are required:',inspect(req_params.missing)));
  }

  var prms = req_params.values,
      packet = { username: prms[0] , password: prms[1] };

  register.validate(packet, function(err, data){
    if (err) return callback(_error(err));

    var api_key = data.api_key,
        config = _ns('common').config;

    var hash = {'control-panel': {}};
    hash['control-panel'].api_key = api_key;
    config.merge(hash, true);
    config.save(function(err) {
      if (err) return callback(_error(err));
      _tr('updated config with api_key');
      callback(null,api_key);
    });
  });
};

/**
 * Register the current device with the Prey control panel.
 **/
var register_device = function(callback) {
  with_current_version(function(err) {
    if (err) callback(_error(err));

    get_keys(function(keys) {
      if (!keys.api) return callback(_error('You need to signup first'));
      if (keys.device) return callback(_error('Device key already registered'));

      var reg = _ns('register');
      _tr('registering device with '+keys.api);
      reg.new_device({api_key:keys.api},function(err,data) {
        if (err) return callback(_error(err));

        var
          dev_key = data.device_key,
          config = _ns('common').config;

          var hash = {'control-panel': {}};
          hash['control-panel'].device_key = dev_key;
          config.merge(hash, true);
          config.save(function(err) {
            if (err) return callback(_error(err));
            _tr('updated config with device_key');

            callback(null);
          });
        });
      });
  });
};

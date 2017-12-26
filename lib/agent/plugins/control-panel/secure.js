var needle      = require('needle'),
    JSEncrypt   = require('node-jsencrypt'),
    opn         = require('opn'),
    exec        = require('child_process').exec,
    keys        = require('./api/keys'),
    common      = require('./../../common'),
    logger      = common.logger.prefix('long-polling'),
    config      = common.config._values['control-panel'],
    account     = require('./../../../conf/account'),
    device_keys = require('./../../../agent/utils/keys-storage'),
    lp_conf     = require('./../../../conf/long-polling');

var crypt = new JSEncrypt(),
    data,
    private_key,
    public_key,
    encoded_key,
    decoded_key;

var protocol   = config.protocol,
    host       = config.host,
    base       = protocol + '://' + host,
    config_url = base + '/api/v2/devices/client_configuration',
    auth_url   = base + '/auth/configuration/start';

var notify_linked = function(specs) {
  var data = {
    "message": {
      "status": "ok",
      "token": encoded_key,
      "api_key": keys.get().api,
      "device_key": keys.get().device,
      "device_info": specs
    }
  }
  needle.post(config_url, data);
}

var notify_error = function() {
  var data = {
    "message":{
      "status": "error",
      "token": encoded_key
    }
  }
  needle.post(config_url, data);
}

exports.set_keys = function(cb) {

  device_keys.exist(['private', 'public'], function(err, exists, values) {
    if (exists) {
      private_key = values[0];
      public_key = values[1];

      crypt.setPublicKey(public_key);
      crypt.setPrivateKey(private_key);

      return cb();

    } else {
      private_key = crypt.getPrivateKey();
      public_key = crypt.getPublicKey();

      crypt.setPublicKey(public_key);
      crypt.setPrivateKey(private_key);

      device_keys.store(['public', 'private'], [public_key, private_key], function(err) {
        if (err) return(cb(new Error("Error storing security keys")));

        return cb();
      })
    }
  });
}

exports.open_config = function() {
  var encoded_key = new Buffer(JSON.stringify(public_key, null, 0)).toString('base64'),
      lang        = common.system.lang || 'en';

  lp_conf.load(encoded_key, function() {
    opn(auth_url + '/' + encoded_key + '/' + lang, {app: 'google chrome'})
  });
}

exports.decrypt_and_notify = function(encrypted_key) {
  var decrypted_key;

  try {
    decrypted_key = crypt.decrypt(encrypted_key);
  } catch(e) {
    logger.error("Unable to decrypt api key");
    return notify_error();
  }

  if (decrypted_key) {
    var key = {
      '-a': decrypted_key
    }
    account.authorize(key, function(err, out) {
      if (err) console.log("ERROR AUTH");
    });
  } else notify_error();

}

exports.notify_linked = notify_linked;
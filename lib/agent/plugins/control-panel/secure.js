var needle      = require('needle'),
    JSEncrypt   = require('node-jsencrypt'),
    keys        = require('./api/keys'),
    common      = require('./../../common'),
    system      = require('./../../../system'),
    agent       = require('./../../../agent');
    account     = require('./../../../conf/account'),
    device_keys = require('./../../utils/keys-storage'),
    logger      = common.logger.prefix('config'),
    os_name     = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

var crypt,
    data,
    private_key,
    public_key,
    public_keys = {},
    decoded_key;

var protocol   = common.config.get('control-panel.protocol'),
    host       = common.config.get('control-panel.host'),
    base       = protocol + '://' + host,
    config_url = base + '/api/v2/devices/client_configuration',
    auth_url   = base + '/auth/configuration/start';

var notify_linked = function(hardware) {
  var data = {
    "message": {
      "status"    : "ok",
      "token"     : public_keys.b64_formatted,
      "api_key"   : keys.get().api,
      "device_key": keys.get().device,
      "version"   : common.version,
      "hardware"  : hardware
    }
  }
  needle.post(config_url, data);
}

var notify_error = function() {
  var data = {
    "message": {
      "status" : "error",
      "token"  : public_keys.b64_formatted
    }
  }
  setTimeout(function() {
    needle.post(config_url, data);
  }, 2000);
}

var format_public_key = function(public_key, cb) {
  public_keys.formatted     = public_key.replace(/\n/g,'').split('BEGIN PUBLIC KEY-----').pop().split('-----END').shift();
  public_keys.b64_formatted = new Buffer(public_keys.formatted).toString('base64');
  
  return cb();
}

exports.generate_keys = function(cb) {
  device_keys.exist(['private', 'public'], function(err, values) {
    if (err) return cb(new Error("Error reading stored security keys"));

    // Read stored keys if they exists
    if (values) {
      private_key = values[0];
      public_key = values[1];

      crypt = new JSEncrypt();
      crypt.setPublicKey(public_key);
      crypt.setPrivateKey(private_key);

      format_public_key(public_key, cb);

    // Create and store new keys
    } else {
      crypt = new JSEncrypt()
      private_key = crypt.getPrivateKey();
      public_key = crypt.getPublicKey();

      crypt.setPublicKey(public_key);
      crypt.setPrivateKey(private_key);

      device_keys.store(['public', 'private'], [public_key, private_key], function(err) {
        if (err) return cb(new Error("Error storing security keys"));
        format_public_key(public_key, cb);
      })
    }
  });
}

exports.open_config = function(device_key, cb) {
  setTimeout(function() {
    var lang = common.system.lang || 'en';

    exports.generate_keys(function(err) {
      var keys = {
        device_key    : device_key,
        client_version: common.version,
        public_key    : public_key,
        language      : lang
      }

      var encoded_keys = new Buffer(JSON.stringify(keys, null, 0)).toString('base64'),
          link         = auth_url + '/' + encoded_keys;

      // Open the logged user's default browser, the prey user doesn't have one
      system.spawn_as_logged_user(__dirname + '/utils/open_browser.sh', [os_name, link], function(err, browser) {
        if (err) return cb(new Error('Unable to open default browser'));

        browser.on('error', function() {
          cb(new Error('Unable to open default browser'));
        });

        browser.once('close', function(code) {
          return cb();
        });

      });
    });
  }, 1000);
}

exports.reset_keys = function(cb) {
  device_keys.exist(['private', 'public'], function() {
    public_key = {};
    exports.generate_keys(cb);
  });
}

exports.decrypt_and_notify = function(encrypted_key, cb) {
  var decrypted_key;

  try {
    decrypted_key = crypt.decrypt(encrypted_key);
  } catch(e) {
    var err = new Error("Unable to decrypt api key: " + e)
    logger.error(err.message);
    notify_error();
    return cb(err)
  }

  keys.del();
  if (decrypted_key) {
    var key = { '-a': decrypted_key }
    account.authorize(key, function(err, out) {
      agent.reload();
      return cb && cb(err);
    });
  } else {
    notify_error();
    var err = new Error("Decryted apy key unavailable")
    return cb(err);
  }
}

exports.public_keys = function() { return public_keys; };
exports.notify_linked = notify_linked;
exports.notify_error  = notify_error;
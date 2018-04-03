var join        = require('path').join,
    needle      = require('needle'),
    JSEncrypt   = require('node-jsencrypt'),
    keys        = require('./api/keys'),
    common      = require('./../../common'),
    device_keys = require('./../../utils/keys-storage'),
    system      = require('./../../../system'),
    agent       = require('./../../../agent'),
    account     = require('./../../../conf/account'),
    cp          = require('child_process'),
    exec        = cp.exec,
    spawn       = cp.spawn,
    run_as_user = system.run_as_logged_user,
    logger      = common.logger.prefix('config'),
    os_name     = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

var crypt,
    data,
    private_key,
    public_key,
    public_keys = {},
    decoded_key;

var panel_host = 'panel.preyproject.com',
    protocol   = common.config.get('control-panel.protocol'),
    host       = common.config.get('control-panel.host'),
    base       = protocol + '://' + host,
    panel_base = protocol + '://' + panel_host,
    config_url = base + '/api/v2/devices/client_configuration',
    auth_url   = panel_base + '/auth/configuration/start';

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
  setTimeout(function() {
    needle.post(config_url, data);
  }, 2000);
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
  public_keys.default       = public_key;
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
    var lang = common.system.lang || 'en',
        child_err;

    exports.generate_keys(function(err) {
      if (err) return cb(err);
      var keys = {
        device_key    : device_key,
        client_version: common.version,
        public_key    : public_key,
        language      : lang
      }

      var encoded_keys = new Buffer(JSON.stringify(keys, null, 0)).toString('base64'),
          link         = auth_url + '/' + encoded_keys;

      if (os_name == 'windows')
        return exec('start ' + link, cb);
      else if (os_name == 'mac')
        return run_as_user('open', [link], cb);
      // Open the logged user's default browser, the prey user doesn't have one

      var child = spawn('xdg-open', [link], {stdio: 'inherit', detached: true});
      child.on('error', function(err) { child_err = err; })
      child.unref();
      // Wait for the error checking
      setTimeout(function() { cb && cb(child_err); }, 1000);
    });
  }, 1000);
}

exports.reset_keys = function(cb) {
  device_keys.del(['private', 'public'], function(err) {
    if (err) return cb(err);
    public_keys = {};
    exports.generate_keys(cb);
  });
}

exports.decrypt_and_notify = function(encrypted_key, cb) {
  var decrypted_key;

  try {
    decrypted_key = crypt.decrypt(encrypted_key);
  } catch(e) {
    var err = new Error("Unable to decrypt api key: " + e);
    logger.error(err.message);
    notify_error();
    return cb(err)
  }

  if (decrypted_key) {
    var key = { '-a': decrypted_key }
    account.authorize(key, function(err, out) {
      return cb && cb(err);
    });
  } else {
    notify_error();
    var err = new Error("Decryted apy key unavailable");
    logger.error(err.message);
    return cb(err);
  }
}

exports.public_keys = function() { return public_keys; };
exports.notify_linked = notify_linked;
exports.notify_error  = notify_error;
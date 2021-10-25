var JSEncrypt   = require('node-jsencrypt'),
    cp          = require('child_process'),
    keys        = require('./api/keys'),
    devices     = require('./api/devices'),
    common      = require('./../../common'),
    // device_keys = require('./../../utils/keys-storage'),
    new_storage  = require('./../../utils/commands_storage'),
    system      = require('./../../../system'),
    account     = require('./../../../conf/account'),
    exec        = cp.exec,
    run_as_user = system.run_as_logged_user,
    logger      = common.logger.prefix('config'),
    os_name     = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

new_storage.init('keys');

var crypt,
    data,
    private_key,
    public_key,
    public_keys = {},
    decoded_key;

var protocol   = common.config.get('control-panel.protocol'),
    host       = common.config.get('control-panel.host'),
    panel_host = host == 'solid.preyproject.com' ? 'panel.preyproject.com' : host
    base       = protocol + '://' + panel_host,
    auth_url   = base + '/auth/configuration/start';

var notify_linked = function(hardware) {
  if (!common.helpers.running_on_background()) return;
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
    devices.post_sso_status(data, function(err) {
      if (err) logger.error("Unable to notify success status: " + err.message)
    })
  }, 2000);
}

var notify_error = function() {
  if (!common.helpers.running_on_background()) return;
  var data = {
    "message": {
      "status" : "error",
      "token"  : public_keys.b64_formatted
    }
  }
  setTimeout(function() {
    devices.post_sso_status(data, function(err) {
      if (err) logger.error("Unable to notify error status: " + err.message)
    })
  }, 2000);
}

var format_public_key = function(public_key, cb) {
  public_keys.default       = public_key;
  public_keys.formatted     = public_key.replace(/\n/g,'').split('BEGIN PUBLIC KEY-----').pop().split('-----END').shift();
  public_keys.b64_formatted = Buffer.from(public_keys.formatted).toString('base64');

  return cb();
}

exports.generate_keys = function(cb) {
  new_storage.do('all', {type: 'keys'}, (err, values) => {
    console.log("VALUES!!", values)
  // device_keys.exist(['private', 'public'], function(err, values) {
    if (err) return cb(new Error("Error reading stored security keys"));

    // Read stored keys if they exists
    if (values.length > 0) {
      private_key = values.find(x =>x.key =='private_key').value;
      public_key = values.find(x =>x.key =='public_key').value;

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

      // new_storage.do('set', {type: 'keys'}, (err, values) => {
      // device_keys.store(['public', 'private'], [public_key, private_key], function(err) {
      new_storage.do('set', {type: 'keys', data: {key: 'public_key', value: public_key }} , function(err) {
        new_storage.do('set', {type: 'keys', data: {key: 'private_key', value: private_key }} , function(err) {
          if (err) return cb(new Error("Error storing security keys"));
          format_public_key(public_key, cb);
        })
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

      var encoded_keys = Buffer.from(JSON.stringify(keys, null, 0)).toString('base64'),
          link         = auth_url + '/' + encoded_keys;

      if (os_name == 'windows')
        return exec('rundll32 url.dll,FileProtocolHandler ' + link, cb);
      else if (os_name == 'mac')
        return run_as_user('open', [link], cb);
      // Open the logged user's default browser, the prey user doesn't have one

      // For linux
      system.spawn_as_logged_user('xdg-open', [link], {env: {DISPLAY: process.env.DISPLAY}}, (err, child) => {
        setTimeout(() => {
          child.kill();
        }, 10000);
        return cb() && cb(err);
      });
    });
  }, 3000);
}

exports.reset_keys = function(cb) {
  // device_keys.del(['private', 'public'], function(err) {
  //   if (err) return cb(err);
  //   public_keys = {};
  //   exports.generate_keys(cb);
  // });
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
    var err = new Error("Decryted api key unavailable");
    logger.error(err.message);
    return cb(err);
  }
}

exports.public_keys = function() { return public_keys; };
exports.notify_linked = notify_linked;
exports.notify_error  = notify_error;
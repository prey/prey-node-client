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
    os_name     = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    system      = require('./../../../system'),
    lp_conf     = require('./../../../conf/long-polling');

var crypt = new JSEncrypt(),
    data,
    private_key,
    public_key,
    parsed_public_key,
    encoded_parsed_public_key,
    decoded_key;

var protocol   = config.protocol,
    host       = config.host,
    base       = protocol + '://' + host,
    config_url = base + '/api/v2/devices/client_configuration',
    auth_url   = base + '/auth/configuration/start';

var notify_linked = function(specs) {
  var data = {
    "message": {
        "token": encoded_parsed_public_key,
        "status": "ok",
        "api_key": keys.get().api,
        "device_key": keys.get().device,
        "version": "1.7.3"
    }
  }
  needle.post(config_url, data);
}

var notify_error = function() {
  var data = {
    "message":{
      "status": "error",
      "token": parsed_public_key
    }
  }
  needle.post(config_url, data);
}

exports.get_keys = function(cb) {
  device_keys.exist(['private', 'public'], function(err, exists, values) {
    if (exists) {
      private_key = values[0];
      public_key = values[1];

      crypt.setPublicKey(public_key);
      crypt.setPrivateKey(private_key);

      parsed_public_key = public_key.replace(/\n/g,'').split('BEGIN PUBLIC KEY-----').pop().split('-----END').shift();
      encoded_parsed_public_key = new Buffer(parsed_public_key).toString('base64');
      return cb(null, public_key, parsed_public_key);

    } else {
      private_key = crypt.getPrivateKey();
      public_key = crypt.getPublicKey();

      crypt.setPublicKey(public_key);
      crypt.setPrivateKey(private_key);

      device_keys.store(['public', 'private'], [public_key, private_key], function(err) {
        if (err) return(cb(new Error("Error storing security keys")));
        
        parsed_public_key = public_key.replace(/\n/g,'').split('BEGIN PUBLIC KEY-----').pop().split('-----END').shift();
        encoded_parsed_public_key = new Buffer(parsed_public_key).toString('base64');
        return cb(null, public_key, parsed_public_key);
      })
    }
  });
}

exports.open_config = function(device_key, cb) {
  var lang = common.system.lang || 'en';

  exports.get_keys(function(err, public_key, parsed_public_key) {
    var keys = {
      device_key: device_key,
      client_version: '1.7.3',
      public_key: public_key,
      language: lang
    }

    var encoded_keys = new Buffer(JSON.stringify(keys, null, 0)).toString('base64');
    console.log(encoded_keys)
    var link = auth_url + '/' + encoded_keys;

    system.spawn_as_logged_user(__dirname + '/browser.sh', [os_name, link], function(err, browser) {
      if (err) console.log("ERR!!:", err);
  
      browser.stdout.on('data', function(data) {
        console.log("DATA!!!", data.toString())
      })
  
      browser.once('close', function(code) {
        console.log("CLOSEEEEE")
        return cb();
      })
    });
  });
}

exports.decrypt_and_notify = function(encrypted_key, cb) {
  var decrypted_key;

  try {
    decrypted_key = crypt.decrypt(encrypted_key);
  } catch(e) {
    var err = new Error("Unable to decrypt api key:" + e)
    logger.error(err.message);
    notify_error();
    return cb(err)
  }
  // console.log("AFTER TRY!!!", decrypted_key)

  common.config._values['control-panel'].api_key = '';
  common.config._values['control-panel'].device_key = '';

  if (decrypted_key) {
    var key = {
      '-a': decrypted_key
    }
    account.authorize(key, function(err, out) {
      console.log("AUTHORIZE:", key)
      if (err) return cb(err);
      return cb();
    });
  } else {
    notify_error();
    var err1 = new Error("Unable to decrypt api key:" + e)
    cb(err1);
  }

}

exports.notify_linked = notify_linked;
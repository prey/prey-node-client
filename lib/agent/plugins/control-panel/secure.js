var needle      = require('needle'),
    JSEncrypt   = require('node-jsencrypt'),
    opn         = require('opn'),
    // logger      = require('./../agent/common').logger.prefix('long-polling'),
    account     = require('./../../../conf/account'),
    device_keys = require('./../../../agent/utils/keys-storage'),
    keys        = require('./api/keys'),
    lp2         = require('./../../../conf/long-polling');

var crypt = new JSEncrypt(),
    private_key,
    public_key,
    encoded_key,
    decoded_key;

var protocol = 'http',
    // host = 'panel.preyhq.com',
    host = '10.10.2.88:3000',
    base = protocol + '://' + host,
    config_url = base + '/api/v2/devices/client_configuration/',
    auth_url   = base + '/auth/configuration/start/';

var data;

var notify_linked = function(specs) {
  var data = {
    "message":{
      "status": "ok",
      "api_key": keys.get().api,
      "device_key": keys.get().device,
      "device_info": specs
    }
  }
  needle.post(url, data);
}

var notify_error = function() {
  var data = {
    "message":{
      "status": "error"
    }
  }
  needle.post(url, data);
}

exports.set_keys = function(cb) {

  device_keys.exist(['private', 'public'], function(err, exists, value) {
    if (exists) {

      private_key = value[0];
      public_key = value[1];

      crypt.setPublicKey(public_key);
      crypt.setPrivateKey(private_key);

      return cb();

    } else {

      private_key = crypt.getPrivateKey();
      public_key = crypt.getPublicKey();

      crypt.setPublicKey(public_key);
      crypt.setPrivateKey(private_key);

      device_keys.store(['public', 'private'], [public_key, private_key], function(err) {
        if (err) return(cb(new Error("Error storing the keys")));

        return cb();
      })
    }
  });
}

exports.open_config = function() {
  // var publicKey   = public_key.split('BEGIN PUBLIC KEY-----\n').pop().split('\n-----END').shift();
  encoded_key = new Buffer(JSON.stringify(public_key, null, 0)).toString('base64');
  lp2.load(encoded_key, function() {
    opn(auth_url + encoded_key, {app: 'google chrome'})
  });
}

exports.decrypt_and_notify = function(encrypted_key) {
  console.log("ENCRYPTED KEY:", encrypted_key);
  var decrypted_api;
  try {
    decoded_key = JSON.parse(new Buffer(encrypted_key, 'base64').toString());
  } catch(e) {
    return console.log("EXCEPTION1!!:", e);
  }
  console.log("DECODED KEY:", decoded_key)
  
  try {
    decrypted_api = crypt.decrypt(decoded_key);
  } catch(e) {
    console.log("EXCEPTION!!:", e);
    return notify_error();
  }

  account.authorize(decrypted_api, function(err, out) {
    if (err) console.log("ERROR AUTH");
  });

}
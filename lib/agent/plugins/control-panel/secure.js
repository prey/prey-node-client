var JSEncrypt = require('node-jsencrypt'),
  cp = require('child_process'),
  keys = require('./api/keys'),
  devices = require('./api/devices'),
  common = require('./../../common'),
  storage = require('./../../utils/storage'),
  system = require('./../../../system'),
  account = require('./../../../conf/account'),
  exec = cp.exec,
  run_as_user = system.run_as_logged_user,
  logger = common.logger.prefix('config'),
  os_name = process.platform
    .replace('darwin', 'mac')
    .replace('win32', 'windows');

var crypt,
  auth_url,
  private_key,
  public_key,
  public_keys = {},
  base;

var protocol = common.config.get('control-panel.protocol'),
  host = common.config.get('control-panel.host'),
  panel_host = host == 'solid.preyproject.com' ? 'panel.preyproject.com' : host;
(base = protocol + '://' + panel_host),
  (auth_url = base + '/auth/configuration/start');

var notify_linked = function (hardware) {
  if (!common.helpers.running_on_background()) return;
  var data = {
    message: {
      status: 'ok',
      token: public_keys.b64_formatted,
      api_key: keys.get().api,
      device_key: keys.get().device,
      version: common.version,
      hardware: hardware,
    },
  };
  setTimeout(function () {
    devices.post_sso_status(data, function (err) {
      if (err) logger.error('Unable to notify success status: ' + err.message);
    });
  }, 2000);
};

var notify_error = function () {
  if (!common.helpers.running_on_background()) return;
  var data = {
    message: {
      status: 'error',
      token: public_keys.b64_formatted,
    },
  };
  setTimeout(function () {
    devices.post_sso_status(data, function (err) {
      if (err) logger.error('Unable to notify error status: ' + err.message);
    });
  }, 2000);
};

var format_public_key = function (public_key, cb) {
  public_keys.default = public_key;
  public_keys.formatted = public_key
    .replace(/\n/g, '')
    .split('BEGIN PUBLIC KEY-----')
    .pop()
    .split('-----END')
    .shift();
  public_keys.b64_formatted = Buffer.from(public_keys.formatted).toString(
    'base64'
  );

  return cb();
};

exports.generate_keys = function (cb) {
  storage.do('all', { type: 'keys' }, (err, values) => {
    if (err || !values)
      return cb(new Error('Error reading stored security keys'));

    // Read stored keys if they exists
    if (
      values.some((value) => value.id === 'public_key') &&
      values.some((value) => value.id === 'private_key')
    ) {
      var private_key_b64 = values.find((x) => x.id == 'private_key').value;
      var public_key_b64 = values.find((x) => x.id == 'public_key').value;
      logger.info(`this is the public_key_b64: ${public_key_b64}`);
      private_key = Buffer.from(private_key_b64, 'base64').toString();
      public_key = Buffer.from(public_key_b64, 'base64').toString();
      logger.info(`this is the Buffer.from(public_key_b64): ${public_key}`);

      crypt = new JSEncrypt();
      crypt.setPublicKey(public_key);
      crypt.setPrivateKey(private_key);

      format_public_key(public_key, cb);

      // Create and store new keys
    } else {
      crypt = new JSEncrypt();
      private_key = crypt.getPrivateKey();
      public_key = crypt.getPublicKey();

      crypt.setPublicKey(public_key);
      crypt.setPrivateKey(private_key);

      storage.do(
        'set',
        {
          type: 'keys',
          id: 'public_key',
          data: { value: Buffer.from(public_key).toString('base64') },
        },
        (err) => {
          if (err) return cb(new Error('Error storing public security key'));
          storage.do(
            'set',
            {
              type: 'keys',
              id: 'private_key',
              data: { value: Buffer.from(private_key).toString('base64') },
            },
            (err) => {
              if (err)
                return cb(new Error('Error storing private security key'));
              format_public_key(public_key, cb);
            }
          );
        }
      );
    }
  });
};

exports.open_config = function (device_key, cb) {
  setTimeout(function () {
    var lang = common.system.lang || 'en';

    exports.generate_keys(function (err) {
      if (err) return cb(err);
      var keys = {
        device_key: device_key,
        client_version: common.version,
        public_key: public_key,
        language: lang,
      };
      logger.info(`this is the keys: ${JSON.stringify(keys)}`);

      var encoded_keys = Buffer.from(JSON.stringify(keys, null, 0)).toString(
          'base64'
        ),
        link = auth_url + '/' + encoded_keys;

      logger.info(`this is the encoded_keys: ${encoded_keys}`);
      if (os_name == 'windows')
        return exec('rundll32 url.dll,FileProtocolHandler ' + link, cb);
      else if (os_name == 'mac') return run_as_user('open', [link], cb);
      // Open the logged user's default browser, the prey user doesn't have one
      // For linux
      cb();
      system.get_logged_user((error, logged_user) => {
        if (error) return;

        exec(
          `sudo -u ${logged_user} ${common.root_path}/lib/agent/utils/openwebbrowser.sh ${link} &`,
          {
            timeout: 200,
          },
          (err, stderr) => {
            if (err || stderr) return;
            process.exit();
          }
        );
      });
      return;
    });
  }, 3000);
};

exports.reset_keys = function (cb) {
  storage.do('del', { type: 'keys', id: 'private_key' }, (err) => {
    if (err) return cb(err);
    storage.do('del', { type: 'keys', id: 'private_key' }, (err) => {
      if (err) return cb(err);
      public_keys = {};
      exports.generate_keys(cb);
    });
  });
};

exports.decrypt_and_notify = function (encrypted_key, cb) {
  var decrypted_key;

  try {
    decrypted_key = crypt.decrypt(encrypted_key);
  } catch (e) {
    var err = new Error('Unable to decrypt api key: ' + e);
    logger.error(err.message);
    notify_error();
    return cb(err);
  }

  if (decrypted_key) {
    common.config.update('api_key', decrypted_key, ()=>{});
    var key = { '-a': decrypted_key };
    account.authorize(key, function (err) {
      return cb && cb(err);
    });
  } else {
    notify_error();
    err = new Error('Decryted api key unavailable');
    logger.error(err.message);
    return cb(err);
  }
};

exports.public_keys = function () {
  return public_keys;
};
exports.notify_linked = notify_linked;
exports.notify_error = notify_error;

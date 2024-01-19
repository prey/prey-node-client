const JSEncrypt = require('node-jsencrypt');
const cp = require('child_process');
const keys = require('./api/keys');
const devices = require('./api/devices');
const common = require('../../common');
const storage = require('../utils/storage');
const system = require('../../system');
const account = require('../../conf/account');

const { exec } = cp;
const run_as_user = system.run_as_logged_user;
const logger = common.logger.prefix('config');
const config = require('../../utils/configfile');

const os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

let crypt;
let private_key;
let public_key;
let public_keys = {};

const protocol = config.getData('control-panel.protocol');
const host = config.getData('control-panel.host');
const panel_host = host === 'solid.preyproject.com' ? 'panel.preyproject.com' : host;
const base = `${protocol}://${panel_host}`;
const auth_url = `${base}/auth/configuration/start`;

const notify_linked = function (hardware) {
  if (!common.helpers.running_on_background()) return;
  const data = {
    message: {
      status: 'ok',
      token: public_keys.b64_formatted,
      api_key: keys.get().api,
      device_key: keys.get().device,
      version: common.version,
      hardware,
    },
  };
  setTimeout(() => {
    devices.post_sso_status(data, (err) => {
      if (err) logger.error(`Unable to notify success status: ${err.message}`);
    });
  }, 2000);
};

const notify_error = function () {
  if (!common.helpers.running_on_background()) return;
  const data = {
    message: {
      status: 'error',
      token: public_keys.b64_formatted,
    },
  };
  setTimeout(() => {
    devices.post_sso_status(data, (err) => {
      if (err) logger.error(`Unable to notify error status: ${err.message}`);
    });
  }, 2000);
};

const format_public_key = function (public_key, cb) {
  public_keys.default = public_key;
  public_keys.formatted = public_key
    .replace(/\n/g, '')
    .split('BEGIN PUBLIC KEY-----')
    .pop()
    .split('-----END')
    .shift();
  public_keys.b64_formatted = Buffer.from(public_keys.formatted).toString(
    'base64',
  );

  return cb();
};

exports.generate_keys = function (cb) {
  storage.do('all', { type: 'keys' }, (err, values) => {
    if (err || !values) { return cb(new Error('Error reading stored security keys')); }

    // Read stored keys if they exists
    if (
      values.some((value) => value.id === 'public_key')
      && values.some((value) => value.id === 'private_key')
    ) {
      const private_key_b64 = values.find((x) => x.id == 'private_key').value;
      const public_key_b64 = values.find((x) => x.id == 'public_key').value;

      private_key = Buffer.from(private_key_b64, 'base64').toString();
      public_key = Buffer.from(public_key_b64, 'base64').toString();

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
              if (err) { return cb(new Error('Error storing private security key')); }
              format_public_key(public_key, cb);
            },
          );
        },
      );
    }
  });
};

exports.open_config = function (device_key, cb) {
  setTimeout(() => {
    const lang = common.system.lang || 'en';

    exports.generate_keys((err) => {
      if (err) return cb(err);
      const keys = {
        device_key,
        client_version: common.version,
        public_key,
        language: lang,
      };

      const encoded_keys = Buffer.from(JSON.stringify(keys, null, 0)).toString(
        'base64',
      );
      const link = `${auth_url}/${encoded_keys}`;

      if (os_name == 'windows') { return exec(`rundll32 url.dll,FileProtocolHandler ${link}`, cb); }
      if (os_name == 'mac') return run_as_user('open', [link], cb);
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
          },
        );
      });
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
  let decrypted_key;

  try {
    decrypted_key = crypt.decrypt(encrypted_key);
  } catch (e) {
    var err = new Error(`Unable to decrypt api key: ${e}`);
    logger.error(err.message);
    notify_error();
    return cb(err);
  }

  if (decrypted_key) {
    config.setData('control-panel.api_key', decrypted_key, () => {
      const key = { '-a': decrypted_key };
      account.authorize(key, (err) => {
        cb && cb(err);
      });
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

/* eslint-disable consistent-return */
const JSEncrypt = require('node-jsencrypt');
const cp = require('child_process');
const keys = require('./api/keys');
const devices = require('./api/devices');
const common = require('../../common');
const storage = require('../utils/storage');
const system = require('../../system');
const account = require('../../conf/account');

const { exec } = cp;
const runAsUser = system.run_as_logged_user;
const logger = common.logger.prefix('config');
const config = require('../../utils/configfile');

const osName = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

let crypt;
let privateKey;
let publicKey;
let publicKeys = {};

const protocol = config.getData('control-panel.protocol');
const host = config.getData('control-panel.host');
let panelHost;
switch (host) {
  case 'solid.preyproject.com':
    panelHost = 'panel.preyproject.com';
    break;
  case 'solid.preyhq.com':
    panelHost = 'panel.preyhq.com';
    break;
  default:
    panelHost = host;
    break;
}
const base = `${protocol}://${panelHost}`;
const authUrl = `${base}/auth/configuration/start`;

const notifyLinked = (hardware) => {
  if (!common.helpers.running_on_background()) return;
  const data = {
    message: {
      status: 'ok',
      token: publicKeys.b64_formatted,
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

const notifyError = () => {
  if (!common.helpers.running_on_background()) return;
  const data = {
    message: {
      status: 'error',
      token: publicKeys.b64_formatted,
    },
  };
  setTimeout(() => {
    devices.post_sso_status(data, (err) => {
      if (err) logger.error(`Unable to notify error status: ${err.message}`);
    });
  }, 2000);
};

const formatPublicKey = (publicKeyFormat, cb) => {
  publicKeys.default = publicKeyFormat;
  publicKeys.formatted = publicKeyFormat
    .replace(/\n/g, '')
    .split('BEGIN PUBLIC KEY-----')
    .pop()
    .split('-----END')
    .shift();
  publicKeys.b64_formatted = Buffer.from(publicKeys.formatted).toString(
    'base64',
  );

  return cb();
};

exports.generate_keys = (cb) => {
  storage.do('all', { type: 'keys' }, (err, values) => {
    if (err || !values) { return cb(new Error('Error reading stored security keys')); }

    // Read stored keys if they exists
    if (
      values.some((value) => value.id === 'public_key')
      && values.some((value) => value.id === 'private_key')
    ) {
      const privateKeyB64 = values.find((x) => x.id === 'private_key').value;
      const publicKeyB64 = values.find((x) => x.id === 'public_key').value;

      privateKey = Buffer.from(privateKeyB64, 'base64').toString();
      publicKey = Buffer.from(publicKeyB64, 'base64').toString();

      crypt = new JSEncrypt();
      crypt.setPublicKey(publicKey);
      crypt.setPrivateKey(privateKey);

      formatPublicKey(publicKey, cb);

      // Create and store new keys
    } else {
      crypt = new JSEncrypt();
      privateKey = crypt.getPrivateKey();
      publicKey = crypt.getPublicKey();

      crypt.setPublicKey(publicKey);
      crypt.setPrivateKey(privateKey);

      storage.do(
        'set',
        {
          type: 'keys',
          id: 'public_key',
          data: { value: Buffer.from(publicKey).toString('base64') },
        },
        (errPublicKey) => {
          if (errPublicKey) return cb(new Error('Error storing public security key'));
          storage.do(
            'set',
            {
              type: 'keys',
              id: 'private_key',
              data: { value: Buffer.from(privateKey).toString('base64') },
            },
            (errPrivateKey) => {
              if (errPrivateKey) { return cb(new Error('Error storing private security key')); }
              formatPublicKey(publicKey, cb);
            },
          );
        },
      );
    }
  });
};

exports.open_config = (deviceKey, cb) => {
  setTimeout(() => {
    const lang = common.system.lang || 'en';

    exports.generate_keys((err) => {
      if (err) return cb(err);
      const generatedKeys = {
        deviceKey,
        client_version: common.version,
        publicKey,
        language: lang,
      };

      const encodedKeys = Buffer.from(JSON.stringify(generatedKeys, null, 0)).toString(
        'base64',
      );
      const link = `${authUrl}/${encodedKeys}`;

      if (osName === 'windows') { return exec(`rundll32 url.dll,FileProtocolHandler ${link}`, cb); }
      if (osName === 'mac') return runAsUser('open', [link], cb);
      // Open the logged user's default browser, the prey user doesn't have one
      // For linux
      cb();
      system.get_logged_user((error, loggedUser) => {
        if (error) return;

        exec(
          `sudo -u ${loggedUser} ${common.root_path}/lib/agent/utils/openwebbrowser.sh ${link} &`,
          {
            timeout: 200,
          },
          (errExec, stderr) => {
            if (errExec || stderr) return;
            process.exit();
          },
        );
      });
    });
  }, 3000);
};

exports.reset_keys = (cb) => {
  storage.do('del', { type: 'keys', id: 'private_key' }, (errDelPub) => {
    if (errDelPub) return cb(errDelPub);
    storage.do('del', { type: 'keys', id: 'private_key' }, (errDelPriv) => {
      if (errDelPriv) return cb(errDelPriv);
      publicKeys = {};
      exports.generate_keys(cb);
    });
  });
};

exports.decrypt_and_notify = (encryptedKey, cb) => {
  let decryptedKey;

  try {
    decryptedKey = crypt.decrypt(encryptedKey);
  } catch (e) {
    const err = new Error(`Unable to decrypt api key: ${e}`);
    logger.error(err.message);
    notifyError();
    return cb(err);
  }

  if (decryptedKey) {
    config.setData('control-panel.api_key', decryptedKey, () => {
      const key = { '-a': decryptedKey };
      account.authorize(key, (err) => {
        // eslint-disable-next-line no-unused-expressions
        cb && cb(err);
      });
    });
  } else {
    notifyError();
    const err = new Error('Decryted api key unavailable');
    logger.error(err.message);
    return cb(err);
  }
};

exports.public_keys = () => publicKeys;

exports.notify_linked = notifyLinked;
exports.notify_error = notifyError;

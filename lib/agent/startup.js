const { join } = require('path');

const fs = require('fs');
const root_path = process.env.ROOT_PATH || join(__dirname, '..', '..');

const configFileName = 'prey.conf';
const defaultConfigFilePath = join(root_path, `${configFileName}.default`);
const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const pathsByOs = require(`../system/${osName}/paths`);
const configFilePath = join(pathsByOs.config, `${configFileName}`);

const ensureAndCreateDb = (cb) => {
  const exists = fs.existsSync(pathsByOs.config) 
  if (exists) return ensureDb(cb);
  fs.mkdir(pathsByOs.config, (err) => {
    if (err) return err;
    ensureDb(cb);
  });

};

const ensureDb = (cb) => {
  const storage = require('../agent/utils/storage');
  storage.init(null, null, () => {
    ensurePreyConf(cb);
  });
};

const ensurePreyConf = (cb) => {
  const exists = fs.existsSync(configFilePath);
  if (exists) return cb();
  if (osName === 'windows') return cb();
  const { setup_permissions, create_user } = require('../conf/tasks/prey_user');
  fs.copyFile(defaultConfigFilePath, configFilePath, (err) => {
    if (err) return cb(err);
    create_user(() => {
      setup_permissions(cb);
    });
  });
};

exports.ensureAndCreateDb = ensureAndCreateDb;
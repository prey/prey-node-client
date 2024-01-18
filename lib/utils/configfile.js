const storage = require('../agent/utils/storage');
const { getDataDb, saveDataToDb, readWithoutVerification } = require('../agent/utils/prey-configuration/preyconf');
const common = require('../agent/common');

const logger = common.logger.prefix('configfile');

const dictionary = {
  auto_connect: 'prey_auto_connect',
  auto_update: 'prey_auto_update',
  download_edge: 'prey_download_edge',
  send_crash_reports: 'prey_send_crash',
  try_proxy: 'prey_try_proxy',
  api_key: 'prey_api_key',
  device_key: 'prey_device_key',
  'control-panel.host': 'prey_control_host',
  'control-panel.protocol': 'prey_control_protocol',
  'control-panel.api_key': 'prey_control_api_key',
  'control-panel.device_key': 'prey_control_device_key',
  'control-panel.send_status_info': 'prey_control_send',
  'control-panel.scan_hardware': 'prey_control_scan',
  'control-panel.location_aware': 'prey_control_location',
};

// eslint-disable-next-line no-unused-vars
class ConfigFile {
  preyConfiguration = {
    auto_connect: false,
    auto_update: true,
    download_edge: false,
    send_crash_reports: null,
    try_proxy: null,
    api_key: null,
    device_key: null,
    'control-panel.host': 'solid.preyproject.com',
    'control-panel.protocol': 'https',
    'control-panel.api_key': null,
    'control-panel.device_key': null,
    'control-panel.send_status_info': true,
    'control-panel.scan_hardware': false,
    'control-panel.location_aware': false,
  };

  constructor() {
    // eslint-disable-next-line no-constructor-return
    if (ConfigFile.instance instanceof ConfigFile) return ConfigFile.instance;
    this.load(() => {
      ConfigFile.instance = this;
    });
  }

  load = (cb) => {
    // eslint-disable-next-line consistent-return
    getDataDb('preyconf', (err, dataDb) => {
      if (err || !dataDb) {
        // eslint-disable-next-line consistent-return
        return readWithoutVerification((errReadWithoutVerification, data) => {
          if (!data) return this.setFull(cb);
          if (errReadWithoutVerification) logger.info(`Error while readWithoutVerification: ${errReadWithoutVerification}`);
          const dataEncounter = {
            apiKey: false,
            deviceKey: false,
          };
          Object.keys(this.preyConfiguration).forEach((key) => {
            if (data[key]) {
              if (key === 'control-panel.api_key') dataEncounter.apiKey = true;
              if (key === 'control-panel.device_key') dataEncounter.deviceKey = true;
              this.preyConfiguration[key] = data[key];
            }
          });
          const gotApiDeviceKey = (dataEncounter.apiKey && dataEncounter.deviceKey).toString();
          if (!err && !dataDb) {
            getDataDb('shouldPreyCFile', (errorGetData, dataFromDb) => {
              if (errorGetData) return;
              if (dataFromDb && dataFromDb.length > 0) {
                storage.do('update', {
                  type: 'keys', id: 'shouldPreyCFile', columns: 'value', values: gotApiDeviceKey,
                }, (errUpdate) => {
                  if (errUpdate) logger.error(`Error while updating shouldPreyCFile: ${errUpdate}`);
                });
              } else {
                storage.do('set', { type: 'keys', id: 'preyconf', data: { value: gotApiDeviceKey } }, (errSetting) => {
                  if (errSetting) logger.error(`Error while setting shouldPreyCFile: ${errSetting}`);
                });
              }
            });
          }
          this.setFull(cb);
        });
      }
      const data = JSON.parse(dataDb[0].value);
      Object.keys(this.preyConfiguration).forEach((key) => {
        if (data[key]) {
          this.preyConfiguration[key] = data[key];
        }
      });
      if (cb && typeof cb === 'function') cb();
    });
  };

  all = () => this.preyConfiguration;

  getData = (key) => {
    try {
      if (process.env[dictionary[`${key}`]]) {
        return process.env[dictionary[`${key}`]];
      }
      return this.preyConfiguration[key];
    } catch (e) {
      return this.preyConfiguration[key];
    }
  };

  setData = (key, value, cb) => {
    this.preyConfiguration[key] = value;
    saveDataToDb(this.preyConfiguration, (error) => {
      if (error) logger.info(`Error while setting prey config: ${error}`);
      if (cb && typeof cb === 'function') cb();
    });
  };

  update = (key, value, cb) => {
    this.preyConfiguration[key] = value;
    saveDataToDb(this.preyConfiguration, (error) => {
      if (error) logger.info(`Error while setting prey config: ${error}`);
      if (cb && typeof cb === 'function') cb();
    });
  };

  setFullFromData = (data, cb) => {
    Object.keys(this.preyConfiguration).forEach((key) => {
      if (data[key]) {
        this.preyConfiguration[key] = data[key];
      }
    });
    saveDataToDb(this.preyConfiguration, (error) => {
      if (error) logger.info(`Error while setting full prey config: ${error}`);
      if (cb && typeof cb === 'function') cb();
    });
  };

  setFull = (cb) => {
    saveDataToDb(this.preyConfiguration, (error) => {
      if (error) logger.info(`Error while setting full prey config: ${error}`);
      if (cb && typeof cb === 'function') cb();
    });
  };
}

const instance = new ConfigFile();
Object.freeze(instance);

module.exports = instance;

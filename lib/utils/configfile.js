const { getDataDb, saveDataToDb, readWithoutVerification } = require('../agent/utils/prey-configuration/preyconf');
const common = require('../agent/common');

const logger = common.logger.prefix('configfile');

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
        return readWithoutVerification((errReadWithoutVerification, data) => {
          if (errReadWithoutVerification) logger.info(`Error while readWithoutVerification: ${errReadWithoutVerification}`);
          Object.keys(this.preyConfiguration).forEach((key) => {
            if (data[key]) {
              this.preyConfiguration[key] = data[key];
            }
          });
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

  getData = (key) => process.env[`prey_${key}`] || this.preyConfiguration[key];

  setData = (key, value) => {
    this.preyConfiguration[key] = value;
    saveDataToDb(this.preyConfiguration, (error) => {
      if (error) logger.info(`Error while setting prey config: ${error}`);
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

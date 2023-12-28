const { getDataDb, saveDataToDb } = require('../agent/utils/prey-configuration/preyconf');
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
      if (err) return cb(err);
      const data = JSON.parse(dataDb[0].value);
      console.log(`en la base de datos hay ${JSON.stringify(data)}`);
      Object.keys(this.preyConfiguration).forEach((key) => {
        if (data[key]) {
          console.log(`${this.preyConfiguration[key]} = ${data[key]}`);
          this.preyConfiguration[key] = data[key];
        }
      });
      console.log(`this.preyConfiguration: ${JSON.stringify(this.preyConfiguration)}`);
      if (cb && typeof cb === 'function') cb();
    });
  };

  all = () => this.preyConfiguration;

  get = (key) => this.preyConfiguration[key];

  set = (key, value) => {
    this.preyConfiguration[key] = value;
    saveDataToDb(this.preyConfiguration, (error) => {
      if (error) logger.info(`Error while setting prey config: ${error}`);
    });
  };
}

const instance = new ConfigFile();
Object.freeze(instance);

module.exports = instance;

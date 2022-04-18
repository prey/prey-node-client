/* eslint-disable linebreak-style */
/// ///////////////////////////////////////
// Prey JS Hardware Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
/// ///////////////////////////////////////

const os = require('os');
const async = require('async');
const network = require('network');
const hooks = require('../../hooks');
const common = require('../../common');

const logger = common.logger.prefix('hardware');
const osName = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
const storage = require('../../utils/storage');

// eslint-disable-next-line import/no-dynamic-require
const osFunctions = require(`./${osName}`);
const exp = module.exports;

exp.get_processor_info = (callback) => {
  const cpus = os.cpus();
  const cpuInfo = {
    model: cpus[0].model.trim(),
    speed: cpus[0].speed,
    cores: cpus.length,
  };
  callback(null, cpuInfo);
};

/**
 * There are no parameters to create a memoized hash key on so supply "key" as default in
 * optional hasher function.
 * */
exp.get_firmware_info = async.memoize((callback) => {
  // eslint-disable-next-line consistent-return
  osFunctions.get_firmware_info((err, data) => {
    if (err) return callback(err);
    // eslint-disable-next-line prefer-const
    let dataFirmwareInfo = data;
    if (data.device_type) dataFirmwareInfo.device_type = data.device_type.replace('Notebook', 'Laptop');

    callback(null, dataFirmwareInfo);
  });
});

exp.get_storage_devices_list = (callback) => callback(new Error('TODO!'));
/**
 * Returns full list of network interfaces, including MAC and broadcast address
 * */

exp.get_network_interfaces_list = network.get_interfaces_list;
exp.get_tpm_module = osFunctions.get_tpm_module;
exp.get_os_edition = osFunctions.get_os_edition;
exp.get_winsvc_version = osFunctions.get_winsvc_version;
exp.get_rp_module = osFunctions.get_recovery_partition_status;

// even though these functions look like they belong in the network provider,
// we put them here because MAC addresses are part of the network interfaces,
// and are not subject to change (even though they can be spoofed)

exp.get_first_mac_address = (callback) => {
  network.get_interfaces_list((err, list) => {
    if (err) callback(err);
    else if (list && list[0] && list[0].mac_address) callback(null, list[0].mac_address);
    callback(new Error('Couldn\'t find any valid MAC addresses!'));
  });
};

exp.get_ram_module_list = osFunctions.get_ram_module_list;

exp.track_hardware_changes = (data) => {
  // eslint-disable-next-line no-param-reassign
  if (data.tpm_module) delete data.tpm_module;
  // eslint-disable-next-line no-param-reassign
  if (data.os_edition) delete data.os_edition;
  // eslint-disable-next-line no-param-reassign
  if (data.winsvc_version) delete data.winsvc_version;
  // eslint-disable-next-line no-param-reassign
  if (data.rp_module) delete data.rp_module;

  let diffCount = 0;
  const saveData = () => {
    storage.do('set', { type: 'keys', id: 'hardware', data: { value: JSON.stringify(data) } }, (err) => {
      if (err) logger.error('Unable to save hardware data');
    });
  };

  // eslint-disable-next-line consistent-return
  const compareField = (current, stored) => {
    if (stored instanceof Array) {
      // eslint-disable-next-line no-plusplus
      if (!current || (current.length > stored.length)) return diffCount++;
      // eslint-disable-next-line consistent-return
      stored.forEach((value) => {
        const foundIndex = current.findIndex((element) => element === value);
        if (foundIndex === -1) {
          // eslint-disable-next-line no-plusplus
          return diffCount++;
        }
      });
    } else if (stored instanceof Object) {
      if (!current || (Object.keys(current).length > Object.keys(stored).length)) {
        // eslint-disable-next-line no-plusplus
        return diffCount++;
      }
      Object.keys(stored).forEach((key) => {
        compareField(current[key], stored[key]);
      });
    // eslint-disable-next-line no-plusplus
    } else if (current !== stored) diffCount++;
  };

  // eslint-disable-next-line consistent-return
  storage.do('query', { type: 'keys', column: 'id', data: 'hardware' }, (error, storedData) => {
    if (error) logger.error('Unable to read hardware data');
    if (storedData.length === 0) return saveData();

    try {
      // eslint-disable-next-line no-param-reassign
      storedData = JSON.parse(storedData[0].value);
    } catch (e) {
      console.log('ERROR!'); // modificar
    }
    compareField(data, storedData);

    if (diffCount > 0) {
      hooks.trigger('hardware_changed');
      storage.do('del', { type: 'keys', id: 'hardware' }, (err) => {
        if (err) logger.error('Unable to delete hardware data');
        saveData();
      });
    }
  });
};

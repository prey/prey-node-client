/* eslint-disable consistent-return */
const os = require('os');
const network = require('network');
const si = require('systeminformation');
const utilStorage = require('../../utils/storage/utilstorage');

const osName = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
// eslint-disable-next-line import/no-dynamic-require
const osFunctions = require(`./${osName}`);
const exp = module.exports;
const hooks = require('../../hooks');
const common = require('../../common');

const logger = common.logger.prefix('hardware');

const exclusionList = ['tpm_module', 'os_edition', 'winsvc_version', 'rp_module', 'prey_user_version', 'killswitch_compatible', 'network_interfaces_list'];
exp.diffCount = 0;
exp.get_processor_info = (callback) => {
  const cpus = os.cpus();
  const cpuInfo = {
    model: cpus[0].model.trim(),
    speed: cpus[0].speed,
    cores: cpus.length,
  };
  callback(null, cpuInfo);
};

exp.get_firmware_info = (callback) => {
  // eslint-disable-next-line consistent-return
  osFunctions.get_firmware_info((err, dataFirmware) => {
    const data = dataFirmware;
    if (err) return callback(err);
    if (data.device_type) data.device_type = data.device_type.replace('Notebook', 'Laptop');
    callback(null, data);
  });
};

exp.get_model_name = (cb) => {
  si.system((stdoutsi) => {
    if (!stdoutsi || !stdoutsi.model) return cb(null, '');
    return cb(null, stdoutsi.model);
  });
};

exp.get_vendor_name = (cb) => {
  si.system((stdoutsi) => {
    if (!stdoutsi || !stdoutsi.manufacturer) return cb(null, '');
    return cb(null, stdoutsi.manufacturer);
  });
};

exp.get_network_interfaces_list = network.get_interfaces_list;
exp.get_tpm_module = osFunctions.get_tpm_module;
exp.get_os_edition = osFunctions.get_os_edition;
exp.get_winsvc_version = osFunctions.get_winsvc_version;
exp.get_rp_module = osFunctions.get_recovery_partition_status;
exp.get_processor_info = (osName === 'mac') ? osFunctions.get_processor_info : exp.get_processor_info;
exp.get_prey_user_version = (osName === 'mac') ? osFunctions.get_prey_user_version : null;
exp.get_osquery_running = (osName === 'windows' || osName === 'mac') ? osFunctions.get_osquery_running : null;
exp.get_killswitch_compatible = (osName === 'windows') ? osFunctions.get_killswitch_compatible : null;

exp.get_first_mac_address = (callback) => {
  try {
    network.get_interfaces_list((err, list) => {
      if (err) return callback(err);
      if (list && list[0] && list[0].mac_address) return callback(null, list[0].mac_address);
      return callback(new Error("Couldn't find any valid MAC addresses!"));
    });
  } catch (error) {
    return callback(new Error(`Couldn't find any valid MAC addresses! ${error}`));
  }
};

exp.get_ram_module_list = osFunctions.get_ram_module_list;

exp.storedComparisonDataHardwareChanged = (stored, dataTrack, callback) => {
  let storedData = stored[0].value;

  if (typeof storedData === 'string') storedData = JSON.parse(storedData);
  if (!storedData.hardwareData) return callback(new Error('No data'));
  storedData.hardwareData.push({ time: (new Date()).toISOString(), dataTrack });
  if (storedData.hardwareData.length > 200) {
    storedData.hardwareData = storedData.hardwareData.slice(1);
  }
  callback(null, storedData);
};

exp.setDataHardwareChanged = (dataTrack) => {
  utilStorage.saveDataDbKey('keys', 'hardware_changed', JSON.stringify({
    hardwareData: [
      {
        time: (new Date()).toISOString(),
        dataTrack,
      },
    ],
  }), (err) => {
    if (err) logger.error('Unable to save hardware changed data');
  });
};

exp.updateDataHardwareChanged = (dataTrack) => {
  utilStorage.getDataDbKey('hardware_changed', (err, stored) => {
    if (err) return;
    if (stored && stored.length > 0) {
      exp.storedComparisonDataHardwareChanged(stored, dataTrack, (errStored, storedData) => {
        if (errStored) return;
        utilStorage.updateDataDbKey('keys', 'hardware_changed', 'value', JSON.stringify(storedData), () => {});
      });
    } else {
      exp.setDataHardwareChanged(dataTrack);
    }
  });
};

const removeKeysFromObjectImmutable = (obj, keys) => Object.keys(obj).reduce((acc, key) => {
  if (!keys.includes(key)) {
    acc[key] = obj[key];
  }
  return acc;
}, {});

const saveData = (dataTrack) => {
  utilStorage.saveDataDbKey('keys', 'hardware', JSON.stringify(dataTrack), (err) => {
    if (err) logger.error('Unable to save hardware data');
  });
};

const orderObject = (olderObject) => {
  if (!olderObject) return olderObject;
  const ordered = Object.keys(olderObject).sort().reduce(
    (newObj, key) => {
      const obj = newObj;
      obj[key] = olderObject[key];
      return obj;
    },
    {},
  );
  return ordered;
};

// eslint-disable-next-line consistent-return
exp.compareField = (current, storedToCompare) => {
  const stored = storedToCompare;
  if (stored instanceof Array) {
    if (!current || (current.length > stored.length)) {
      exp.diffCount += 1;
      return exp.diffCount;
    }
    let hasKeyName = (stored.length > 0) ? Object.prototype.hasOwnProperty.call(stored[0], 'name') : false;
    let hasKeyBank = (stored.length > 0) ? Object.prototype.hasOwnProperty.call(stored[0], 'bank') : false;
    if (hasKeyName) stored.sort((a, b) => (a.name > b.name ? 1 : -1));
    if (hasKeyBank) stored.sort((a, b) => (a.bank > b.bank ? 1 : -1));
    if (current instanceof Array) {
      hasKeyName = (current.length > 0) ? Object.prototype.hasOwnProperty.call(current[0], 'name') : false;
      hasKeyBank = (current.length > 0) ? Object.prototype.hasOwnProperty.call(current[0], 'bank') : false;

      if (hasKeyName) current.sort((a, b) => (a.name > b.name ? 1 : -1));
      if (hasKeyBank) current.sort((a, b) => (a.bank > b.bank ? 1 : -1));
    }
    // eslint-disable-next-line consistent-return
    stored.forEach((value) => {
      if (value instanceof Object) {
        // eslint-disable-next-line no-use-before-define
        exp.compareSubField(orderObject(current), orderObject(stored));
      } else {
        const foundIndex = current.findIndex((element) => element === value);
        if (foundIndex === -1) {
          exp.diffCount += 1;
          return exp.diffCount;
        }
      }
    });
  } else if (stored instanceof Object) {
    // eslint-disable-next-line no-use-before-define
    exp.compareSubField(orderObject(current), orderObject(stored));
  } else if (current !== stored) exp.diffCount += 1;
};

// eslint-disable-next-line consistent-return
exp.compareSubField = (curr, stored) => {
  let current = curr;
  if (!curr || (Object.keys(curr).length > Object.keys(stored).length)) {
    current = (curr instanceof Object) ? JSON.parse(JSON.stringify(curr)) : undefined;
    if (current && stored) {
      if (Object.keys(current).length > Object.keys(stored).length) {
        exp.diffCount += 1;
        return exp.diffCount;
      }
    }
  }
  Object.keys(stored).forEach((key) => {
    if (!key.includes('ip') && !key.includes('netmask') && current && stored) {
      exp.compareField(current[key], stored[key]);
    }
  });
};

exp.track_hardware_changes = (dataTrack) => {
  let data;
  if (typeof dataTrack !== 'object') data = dataTrack;
  if (dataTrack && typeof dataTrack === 'object') data = removeKeysFromObjectImmutable(dataTrack, exclusionList);
  utilStorage.getDataDbKey('hardware_changed', (err, stored) => {
    if (err || (stored && stored.length > 0)) return;
    exp.setDataHardwareChanged(dataTrack);
  });
  exp.diffCount = 0;
  // eslint-disable-next-line consistent-return
  utilStorage.getDataDbKey('hardware', (err, storedDt) => {
    if (err) logger.error('Unable to read hardware data');
    let storedData = storedDt;
    if (storedData && storedData.length === 0) return saveData(dataTrack);

    try {
      storedData = JSON.parse(storedData[0].value);
    } catch (e) {
      logger.info(`Error: ${e}`);
    }
    // eslint-disable-next-line consistent-return
    let dataStoredModified;
    if (typeof storedData !== 'object') dataStoredModified = storedData;
    if (storedData && typeof storedData === 'object') dataStoredModified = removeKeysFromObjectImmutable(storedData, exclusionList);

    exp.compareField(data, dataStoredModified);

    if (exp.diffCount > 0) {
      hooks.trigger('hardware_changed');
      exp.updateDataHardwareChanged(dataTrack);
      utilStorage.deleteDbKey('hardware', (errDel) => {
        if (errDel) logger.error('Unable to delete hardware data');
        saveData(dataTrack);
      });
    }
  });
};

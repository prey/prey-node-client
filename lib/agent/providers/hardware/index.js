// @ts-check
/* eslint-disable consistent-return */
const os = require('os');
const network = require('network');
const si = require('systeminformation');
const utilStorage = require('../../utils/storage/utilstorage');

const osName = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
// eslint-disable-next-line import/no-dynamic-require
const osFunctions = require(`./${osName}`);
// Dynamic export bag: getters are attached below by name (see providers.js
// convention). Typed as any so property assignments type-check under // @ts-check.
const exp = /** @type {any} */ (module.exports);
// hooks exposes a custom trigger method on top of EventEmitter.
const hooks = /** @type {any} */ (require('../../hooks'));
const common = require('../../common');
const { isPlaceholder } = require('./placeholders');

const logger = common.logger.prefix('hardware');

const exclusionList = ['tpm_module', 'os_edition', 'winsvc_version', 'rp_module', 'prey_user_version', 'killswitch_compatible', 'network_interfaces_list'];
exp.diffCount = 0;
exp.get_processor_info = (callback) => {
  const cpus = os.cpus();
  if (!cpus || cpus.length === 0 || !cpus[0]) {
    logger.warn('os.cpus() returned no CPU data');
    return callback(null, { model: '', speed: 0, cores: 0 });
  }
  const cpuInfo = {
    model: cpus[0].model ? cpus[0].model.trim() : '',
    speed: cpus[0].speed || 0,
    cores: cpus.length,
  };
  callback(null, cpuInfo);
};

/**
 * Completes a partial firmware read with the values of the stored hardware
 * snapshot, only when both belong to the same machine (same uuid). A failed read
 * then never reaches the panel as a missing serial, while a real board swap still
 * shows up because that read brings a different uuid/serial.
 * @param {Record<string, any>} current
 * @param {(filled: Record<string, any>) => void} cb
 */
exp.fillFirmwareFromStored = (current, cb) => {
  utilStorage.getDataDbKey('hardware', (err, stored) => {
    if (err || !stored || stored.length === 0) return cb(current);
    let storedFirmware;
    try {
      storedFirmware = JSON.parse(stored[0].value).firmware_info;
    } catch (e) {
      return cb(current);
    }
    if (!storedFirmware || typeof storedFirmware !== 'object'
      || isPlaceholder(current.uuid) || storedFirmware.uuid !== current.uuid) return cb(current);

    const missing = Object.keys(storedFirmware)
      .filter((key) => isPlaceholder(current[key]) && !isPlaceholder(storedFirmware[key]));
    if (missing.length === 0) return cb(current);

    logger.warn(`Incomplete firmware read, using last known values for: ${missing.join(', ')}`);
    const filled = { ...current };
    missing.forEach((key) => { filled[key] = storedFirmware[key]; });
    cb(filled);
  });
};

/**
 * @param {(err: Error|null, data?: Record<string, any>) => void} callback
 */
exp.get_firmware_info = (callback) => {
  // eslint-disable-next-line consistent-return
  osFunctions.get_firmware_info((err, dataFirmware) => {
    const data = dataFirmware;
    if (err) return callback(err);
    if (data.device_type) data.device_type = data.device_type.replace('Notebook', 'Laptop');
    exp.fillFirmwareFromStored(data, (filled) => {
      // The panel's firmware setters truncate strings and raise on null, failing
      // the whole specs/registration request, so null values are left out.
      const clean = {};
      Object.keys(filled).forEach((key) => {
        if (filled[key] !== null && typeof filled[key] !== 'undefined') clean[key] = filled[key];
      });
      callback(null, clean);
    });
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

/**
 * Wraps network.get_interfaces_list so a synchronous os.networkInterfaces() failure
 * (ERR_SYSTEM_ERROR from uv_interface_addresses while adapters change, OWCA-633) becomes
 * a callback error tagged as not fatal instead of an exception reported by providers.js.
 * @param {(err: Error|null, list?: *) => void} cb
 * @returns {void}
 */
exp.get_network_interfaces_list = (cb) => {
  try {
    network.get_interfaces_list(cb);
  } catch (error) {
    const err = /** @type {Error & { level?: string }} */ (
      new Error(`Failed to list network interfaces: ${error && error.message}`));
    err.level = 'not fatal';
    if (typeof cb === 'function') cb(err);
  }
};
exp.get_tpm_module = osFunctions.get_tpm_module;
exp.get_os_edition = osFunctions.get_os_edition;
exp.get_winsvc_version = osFunctions.get_winsvc_version;
exp.get_rp_module = osFunctions.get_recovery_partition_status;
exp.get_processor_info = (osName === 'mac') ? osFunctions.get_processor_info : exp.get_processor_info;
exp.get_prey_user_version = (osName === 'mac') ? osFunctions.get_prey_user_version : null;
exp.get_osquery_running = (osName === 'windows' || osName === 'mac') ? osFunctions.get_osquery_running : null;
exp.get_killswitch_compatible = (osName === 'windows') ? osFunctions.get_killswitch_compatible : null;
exp.get_ubuntu_session_type = (osName === 'linux') ? osFunctions.get_ubuntu_session_type : null;
exp.get_ubuntu_session_display = (osName === 'linux') ? osFunctions.get_ubuntu_session_display : null;

// Track session changes (Linux only) - checks every hour and sends data to server when changes detected
exp.track_session_changes = () => {
  if (osName !== 'linux') return; // Only works on Linux

  const checkAndSendSessionData = () => {
    osFunctions.check_session_changes((err, result) => {
      if (err) {
        logger.error(`Error checking session changes: ${err.message}`);
        return;
      }

      // If any chenges detected, send new data
      if (result.hasChanges) {
        let data = {
          ubuntu_session_type: result.sessionType,
          ubuntu_session_display: result.display
        };

        hooks.trigger('data', "specs", data)
      }
    });
  };
  setTimeout(() => {
    checkAndSendSessionData();
    // After initial check, start interval checking
    setInterval(checkAndSendSessionData, 1000 * 60 * 60); // check every hour
  }, 5000)
};

exp.get_first_mac_address = (callback) => {
  try {
    network.get_interfaces_list((err, list) => {
      if (err) return callback(err);
      if (list && list[0] && list[0].mac_address) return callback(null, list[0].mac_address);
      return callback(new Error("Couldn't find any valid MAC addresses!"));
    });
  } catch (error) {
    // os.networkInterfaces() can fail transiently (OWCA-633): not fatal, do not report.
    const err = /** @type {Error & { level?: string }} */ (
      new Error(`Couldn't find any valid MAC addresses! ${error}`));
    err.level = 'not fatal';
    return callback(err);
  }
};

exp.get_ram_module_list = osFunctions.get_ram_module_list;

exp.storedComparisonDataHardwareChanged = (stored, dataTrack, callback) => {
  let storedData = stored[0].value;

  if (typeof storedData === 'string') storedData = JSON.parse(storedData);
  if (!storedData.hardwareData) return callback(new Error('No data'));
  storedData.hardwareData.push({ time: (new Date()).toISOString(), dataTrack });
  if (storedData.hardwareData.length > 100) {
    storedData.hardwareData = storedData.hardwareData.slice(1, 101);
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

/**
 * Adds to exp.diffCount for each real difference. A missing or placeholder value
 * on either side is a failed or empty read, not a hardware change.
 * @param {*} current
 * @param {*} storedToCompare
 */
// eslint-disable-next-line consistent-return
exp.compareField = (current, storedToCompare) => {
  const stored = storedToCompare;
  if (isPlaceholder(current) || isPlaceholder(stored)) return;
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

/**
 * Compares two objects key by key over the union of their keys. A key present on
 * one side only is not a change by itself (a partial read drops keys, a complete
 * one brings them back); compareField skips the missing side.
 * @param {*} curr
 * @param {*} stored
 */
exp.compareSubField = (curr, stored) => {
  if (!(curr instanceof Object) || !(stored instanceof Object)) return;
  const keys = new Set([...Object.keys(curr), ...Object.keys(stored)]);
  keys.forEach((key) => {
    if (!key.includes('ip') && !key.includes('netmask')) {
      exp.compareField(curr[key], stored[key]);
    }
  });
};

const isPlainObject = (value) => value instanceof Object && !(value instanceof Array);

/**
 * Builds the baseline to store: the current read, keeping the stored value
 * wherever the current one is missing or a placeholder, so a partial read never
 * becomes the reference for the next comparison.
 * @param {*} current
 * @param {*} stored
 * @returns {*}
 */
exp.mergeWithStored = (current, stored) => {
  if (isPlaceholder(current)) return stored;
  if (!isPlainObject(current) || !isPlainObject(stored)) return current;
  const merged = { ...stored };
  Object.keys(current).forEach((key) => {
    merged[key] = exp.mergeWithStored(current[key], stored[key]);
  });
  return merged;
};

/**
 * True when the current read has a real value where the stored baseline only has
 * a missing or placeholder one (e.g. the baseline was saved from a partial read).
 * @param {*} current
 * @param {*} stored
 * @returns {boolean}
 */
exp.fillsStoredGaps = (current, stored) => {
  if (isPlaceholder(stored)) return !isPlaceholder(current);
  if (!isPlainObject(current) || !isPlainObject(stored)) return false;
  return Object.keys(current).some((key) => exp.fillsStoredGaps(current[key], stored[key]));
};

/**
 * @param {*} baseline
 */
const replaceBaseline = (baseline) => {
  utilStorage.deleteDbKey('hardware', (errDel) => {
    if (errDel) logger.error('Unable to delete hardware data');
    saveData(baseline);
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
    if (!storedData || (storedData && storedData.length === 0)) return saveData(dataTrack);

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

    const baseline = (storedData && typeof storedData === 'object')
      ? exp.mergeWithStored(dataTrack, storedData) : dataTrack;

    if (exp.diffCount > 0) {
      hooks.trigger('hardware_changed');
      exp.updateDataHardwareChanged(dataTrack);
      replaceBaseline(baseline);
    } else if (exp.fillsStoredGaps(data, dataStoredModified)) {
      // Same hardware, but the stored baseline came from a partial read: complete it
      // silently so later reads are compared (and filled) against full values.
      logger.info('Completing stored hardware baseline with the values just read');
      replaceBaseline(baseline);
    }
  });
};

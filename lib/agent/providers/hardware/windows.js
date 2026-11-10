// @ts-check
const { exec } = require('child_process');
const { join } = require('path');
const {
  system, bios, baseboard, battery,
} = require('../../utils/utilinformation');
// system/windows aggregates its API via dynamic assignment, so its members
// (os_release, paths, spawn_as_admin_user, ...) aren't statically visible to tsc.
const systemW = /** @type {any} */ (require('../../../system/windows'));
const common = require('../../common');
const { isPlaceholder } = require('./placeholders');

const logger = common.logger.prefix('hardware-windows');
const gte = common.helpers.is_greater_or_equal;

// A stable, writable working directory for spawned children. During an upgrade the
// process may inherit an invalid/read-only cwd (e.g. the version dir being replaced),
// which makes child_process spawn throw synchronously with `spawn EROFS`. Forcing a
// known-good cwd on every spawn avoids that failure mode.
const SAFE_CWD = join(process.env.WINDIR || String.raw`C:\Windows`, 'Temp');

const ramFormFactors = [
  'Unknown',
  'Other',
  'SIP',
  'DIP',
  'ZIP',
  'SOJ',
  'Proprietary',
  'SIMM',
  'DIMM',
  'TSOP',
  'PGA',
  'RIMM',
  'SODIMM',
  'SRIMM',
  'SMD',
  'SSMP',
  'QFP',
  'TQFP',
  'SOIC',
  'LCC',
  'PLCC',
  'BGA',
  'FPBGA',
  'LGA',
];

const ramTypes = [
  'Unknown',
  'Other',
  'DRAM',
  'Synchronous DRAM',
  'Cache DRAM',
  'EDO',
  'EDRAM',
  'VRAM',
  'SRAM',
  'RAM',
  'ROM',
  'Flash',
  'EEPROM',
  'FEPROM',
  'EPROM',
  'CDRAM',
  '3DRAM',
  'SDRAM',
  'SGRAM',
  'RDRAM',
  'DDR',
  'DDR2',
];

// WMI reads come back empty (systeminformation never rejects) while the service is
// stopping or WMI is not ready yet at boot, so empty BIOS/baseboard reads are retried.
const FIRMWARE_READ_RETRIES = 2;
const FIRMWARE_RETRY_DELAY = 3000;

/**
 * Calls a systeminformation reader until its result is valid or retries run out,
 * then hands over the last result (valid or not).
 * @param {(done: (result: any) => void) => void} reader
 * @param {(result: any) => boolean} isValid
 * @param {number} retriesLeft
 * @param {(result: any) => void} cb
 */
const readWithRetry = (reader, isValid, retriesLeft, cb) => {
  reader((result) => {
    if (isValid(result) || retriesLeft <= 0) {
      cb(result);
      return;
    }
    setTimeout(() => readWithRetry(reader, isValid, retriesLeft - 1, cb), FIRMWARE_RETRY_DELAY);
  });
};

/**
 * Reads system, BIOS, baseboard and battery info. A failed BIOS read no longer
 * skips the baseboard: each part fills only its own fields, so a partial read
 * leaves fields missing (to be completed from the stored snapshot) instead of
 * dropping everything after the first failure.
 * @param {(err: Error|null, data?: Record<string, any>) => void} callback
 */
exports.get_firmware_info = (callback) => {
  const data = {};

  system((stdoutsiSys) => {
    if (!stdoutsiSys || !stdoutsiSys.uuid || stdoutsiSys.uuid.toString().trim() === '') {
      callback(new Error('No Info found.'));
      return;
    }
    data.uuid = stdoutsiSys.uuid.toUpperCase();
    data.serial_number = stdoutsiSys.serial;
    data.model_name = stdoutsiSys.model;
    data.vendor_name = stdoutsiSys.manufacturer;

    const validBios = (res) => !!res && !isPlaceholder(res.vendor);
    const validBaseboard = (res) => !!res && !isPlaceholder(res.manufacturer);

    readWithRetry(bios, validBios, FIRMWARE_READ_RETRIES, (stdoutsiBios) => {
      if (validBios(stdoutsiBios)) {
        logger.info(`bios : ${JSON.stringify(stdoutsiBios)}`);
        data.bios_vendor = stdoutsiBios.vendor;
        data.bios_version = stdoutsiBios.version;
      } else {
        logger.warn('Unable to read BIOS info');
      }

      readWithRetry(baseboard, validBaseboard, FIRMWARE_READ_RETRIES, (stdoutsiBaseBoard) => {
        if (!validBaseboard(stdoutsiBaseBoard)) {
          // WMI is not answering: a battery read now would report "no battery" and
          // flip device_type to Desktop, so leave it out as well.
          logger.warn('Unable to read baseboard info');
          callback(null, data);
          return;
        }
        data.mb_vendor = stdoutsiBaseBoard.manufacturer;
        // An empty serial is left out, never sent as null: the panel rejects null
        // firmware values and the whole report would fail.
        if (stdoutsiBaseBoard.serial) data.mb_serial = stdoutsiBaseBoard.serial;
        data.mb_model = stdoutsiBaseBoard.model;
        data.mb_version = stdoutsiBaseBoard.version;
        battery((stdoutsiBattery) => {
          data.device_type = (!stdoutsiBattery || !stdoutsiBattery.hasBattery) ? 'Desktop' : 'Laptop';
          callback(null, data);
        });
      });
    });
  });
};

/**
 * @param {(err: (Error|null), list?: Array<any>) => void} cb
 */
exports.get_ram_module_list = (cb) => {
  const list = [];
  const file = join(__dirname, 'ramcheck.vbs');

  try {
    // eslint-disable-next-line consistent-return
    exec(`cscript ${file} /B`, { timeout: 15000, cwd: SAFE_CWD }, (err, stdout) => {
      if (err) return cb(err);

      stdout.toString().split('---').forEach((block) => {
        const data = {};

        block.split('\n').forEach((line) => {
          const split = line.split(':');
          const key = split[0].replace(/ /g, '-');
          const val = (split[1] || '').trim();

          if (val && val !== '') data[key] = val;
        });

        if (!data.Name) return;

        list.push({
          name: data.Name,
          bank: data['Bank-Label'],
          location: data['Device-Locator'],
          size: parseInt(data.Capacity, 10) / 1048576,
          form_factor: ramFormFactors[parseInt(data['Form-Factor'], 10)] || 'Unknown',
          memory_type: ramTypes[parseInt(data['Memory-Type'], 10)] || 'Unknown',
          speed: parseInt(data.Speed, 10),
          data_width: parseInt(data['Data-Width'], 10),
        });
      });

      cb(null, list);
    });
  } catch (e) {
    // synchronous spawn throw (e.g. `spawn EROFS`) — deliver as a callback error
    cb(/** @type {Error} */ (e));
  }
};

exports.get_tpm_module = (cb) => {
  systemW.get_as_admin('tpmModule', (err, infoData) => {
    exports.resolveTpmModuleInfo(err, infoData, cb);
  });
};

exports.resolveTpmModuleInfo = (err, infoData, cb) => {
  const info = infoData;
  if (err) return cb(err);
  if (typeof info === 'string') {
    try {
      JSON.parse(info);
    } catch (e) {
      return cb(new Error(`Error getting tpm module info: ${e.message}`));
    }
  }
  try {
    info.manufacturer_version = info.manufacturerVersion;
    delete info.manufacturerVersion;
  } catch (e) {
    return cb(new Error(`Error getting tpm module info: ${e.message}`));
  }

  return cb(null, info);
};

// eslint-disable-next-line consistent-return
exports.get_recovery_partition_status = (cb) => {
  if (gte(systemW.os_release, '10.0.0')) {
    const json = {};
    json.available = false;
    systemW.get_as_admin('recoveryPartition', (err, info) => {
      if (err) return cb(err);
      try {
        json.available = info.enabled;
        logger.info(`info from recovery partition:${JSON.stringify(info)}`);
      } catch (e) {
        return cb(new Error(`Error recoveryPartition info: ${e.message}`));
      }
      return cb(null, json);
    });
  } else {
    return cb(new Error('Only for version '));
  }
};

exports.get_killswitch_compatible = (cb) => {
  const data = {
    key: 'device-key',
    token: 'token',
    logged: false,
    dirs: [],
  };
  const nodeBin = join(systemW.paths.current, 'bin', 'node');
  const action = 'check-full-wipe';

  // eslint-disable-next-line consistent-return
  systemW.spawn_as_admin_user(nodeBin, data, (errFirst, childWinsvcCb) => {
    if (errFirst) {
      return cb(errFirst, undefined, 'killswitch_compatible');
    }
    if (typeof childWinsvcCb === 'function') {
      // eslint-disable-next-line consistent-return
      childWinsvcCb(action, data, (errCheckFullWipeCb, checkFullWipeCb) => {
        if (errCheckFullWipeCb) {
          return cb(errFirst, undefined, 'killswitch_compatible');
        }
        if (checkFullWipeCb.error) {
          return cb(new Error(checkFullWipeCb.message), false, 'killswitch_compatible');
        }
        cb(null, true, 'killswitch_compatible');
      });
    } else {
      cb(null, undefined, 'killswitch_compatible');
    }
  });
};
/**
 * @param {(err: (Error|null), running: (boolean|undefined), key: string) => void} cb
 */
exports.get_osquery_running = (cb) => {
  try {
    exec('sc query preyosqueryd', { timeout: 8000, cwd: SAFE_CWD }, (err, stdout, stderr) => {
      if (err) return cb(null, false, 'osquery_running');
      if (stderr) return cb(null, false, 'osquery_running');
      if (stdout.includes('RUNNING')) {
        return cb(null, true, 'osquery_running');
      }
      return cb(null, false, 'osquery_running');
    });
  } catch (e) {
    // synchronous spawn throw (e.g. `spawn EROFS`) — treat as not running
    cb(null, false, 'osquery_running');
  }
};

exports.get_os_edition = systemW.get_os_edition;
exports.get_winsvc_version = systemW.get_winsvc_version;

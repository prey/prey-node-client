const { exec } = require('child_process');
const { join } = require('path');
const {
  system, bios, baseboard, battery,
} = require('../../utils/utilinformation');
const systemW = require('../../../system/windows');
const common = require('../../common');

const logger = common.logger.prefix('hardware-windows');
const gte = common.helpers.is_greater_or_equal;

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

exports.get_firmware_info = (callback) => {
  const data = {};

  system((stdoutsiSys) => {
    if (!stdoutsiSys || !stdoutsiSys.uuid || stdoutsiSys.uuid.toString().trim() === '') {
      callback(new Error('No Info found.'));
    } else {
      data.uuid = stdoutsiSys.uuid.toUpperCase();
      data.serial_number = stdoutsiSys.serial;
      data.model_name = stdoutsiSys.model;
      data.vendor_name = stdoutsiSys.manufacturer;

      bios((stdoutsiBios) => {
        if (!stdoutsiBios || !stdoutsiBios.vendor || stdoutsiBios.vendor.toString().trim() === '') {
          callback(null, data);
        } else {
          logger.info(`bios : ${JSON.stringify(stdoutsiBios)}`);
          data.bios_vendor = stdoutsiBios.vendor;
          data.bios_version = stdoutsiBios.version;
          baseboard((stdoutsiBaseBoard) => {
            if (!stdoutsiBaseBoard || !stdoutsiBaseBoard.manufacturer || stdoutsiBaseBoard.manufacturer.toString().trim() === '') {
              callback(null, data);
            } else {
              data.mb_vendor = stdoutsiBaseBoard.manufacturer;
              data.mb_serial = (stdoutsiBaseBoard.serial) ? (stdoutsiBaseBoard.serial) : null;
              data.mb_model = stdoutsiBaseBoard.model;
              data.mb_version = stdoutsiBaseBoard.version;
              battery((stdoutsiBattery) => {
                if (!stdoutsiBattery || !stdoutsiBattery.hasBattery) {
                  data.device_type = 'Desktop';
                  callback(null, data);
                } else {
                  data.device_type = 'Laptop';
                  callback(null, data);
                }
              });
            }
          });
        }
      });
    }
  });
};

exports.get_ram_module_list = (cb) => {
  const list = [];
  const file = join(__dirname, 'ramcheck.vbs');

  // eslint-disable-next-line consistent-return
  exec(`cscript ${file} /B`, (err, stdout) => {
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
exports.get_osquery_running = (cb) => {
  exec('sc query preyosqueryd', (err, stdout, stderr) => {
    if (err) return cb(null, false, 'osquery_running');
    if (stderr) return cb(null, false, 'osquery_running');
    if (stdout.includes('RUNNING')) {
      return cb(null, true, 'osquery_running');
    }
    return cb(null, false, 'osquery_running');
  });
};

exports.get_os_edition = systemW.get_os_edition;
exports.get_winsvc_version = systemW.get_winsvc_version;

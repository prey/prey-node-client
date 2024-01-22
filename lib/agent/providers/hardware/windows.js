const { exec } = require('child_process');
const { join } = require('path');
const wmic = require('wmic');
const si = require('systeminformation');
const system = require('../../../system/windows');
const common = require('../../../common');

const logger = common.logger.prefix('wmic');
const gte = common.helpers.is_greater_or_equal;
const { isBoolean } = require('../../utils/utilsprey');

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

const firmwareKeys = {
  uuid: ['path win32_computersystemproduct', 'uuid'],
  serial_number: ['bios', 'serialnumber'],
  bios_vendor: ['bios', 'Manufacturer'],
  bios_version: ['bios', 'SMBIOSBIOSVersion'],
  mb_vendor: ['baseboard', 'manufacturer'],
  mb_serial: ['baseboard', 'serialnumber'],
  mb_model: ['baseboard', 'product'],
  mb_version: ['baseboard', 'version'],
  device_type: ['path Win32_Battery', 'Availability'],
  model_name: ['computersystem', 'Model'],
  vendor_name: ['computersystem', 'Manufacturer'],
};

let count = Object.keys(firmwareKeys).length;
// eslint-disable-next-line consistent-return

const finishedfirmwareKeysInfo = (data, callback) => {
  count -= 1;
  if (count <= 0) {
    callback(null, data);
  }
};

const hasBattery = (type, dataFirmware, key, callback) => {
  let res = type;
  const data = dataFirmware;
  try {
    exec('powershell @(Get-CimInstance -ClassName Win32_Battery).Count -gt 0', (errorhasBattery, hasBatteryPresent) => {
      if (errorhasBattery) logger.info(`Error on getting Chassistype: ${errorhasBattery}`);
      // eslint-disable-next-line no-extra-boolean-cast
      if (isBoolean(hasBatteryPresent)) res = 'Laptop';
      if (res) data[key] = res;
      finishedfirmwareKeysInfo(data, callback);
    });
  } catch (exception) {
    finishedfirmwareKeysInfo(null, callback);
  }
};

exports.get_firmware_info = (callback) => {
  let data = {};
  const fetch = (key, section, value) => {
    wmic.get_value(section, value, null, (err, resp) => {
      let res = resp;
      if (key === 'device_type') {
        res = err ? 'Desktop' : 'Laptop';
        if (res === 'Laptop') {
          if (!err && res) data[key] = res;
          finishedfirmwareKeysInfo(data, callback);
        } else {
          try {
            exec('wmic systemenclosure get ChassisTypes', (_errorChassisTypes, Chassistypes) => {
              const laptopTypes = [9, 10, 14];
              const typeNumber = Number(Chassistypes.match(/\d+/g));
              if (laptopTypes.includes(typeNumber)) {
                res = 'Laptop';
                logger.info(`Chassistypes: ${typeNumber}, type: ${res}`);
                if (res) data[key] = res;
                finishedfirmwareKeysInfo(data, callback);
              } else {
                hasBattery(res, data, key, callback);
              }
            });
          } catch (error) {
            if (error) logger.info(`Error on getting Chassistype: ${error}`);
            hasBattery(res, data, key, callback);
          }
        }
      } else {
        data[key] = res;
        finishedfirmwareKeysInfo(data, callback);
      }
    });
  };

  wmic.get_value('path win32_computersystemproduct', 'uuid', null, (err) => {
    if (err) {
      data = {
        uuid: '',
        serial_number: '',
        bios_vendor: '',
        bios_version: '',
        mb_vendor: '',
        mb_serial: '',
        mb_model: '',
        mb_version: '',
        device_type: '',
        model_name: '',
        vendor_name: '',
      };

      si.system((stdoutsiSys) => {
        if (!stdoutsiSys || !stdoutsiSys.uuid || stdoutsiSys.uuid.toString().trim() === '') {
          callback(new Error('No Info found.'));
        } else {
          data.uuid = stdoutsiSys.uuid.toUpperCase();
          data.serial_number = stdoutsiSys.serial;
          data.model_name = stdoutsiSys.model;
          data.vendor_name = stdoutsiSys.manufacturer;

          si.bios((stdoutsiBios) => {
            if (!stdoutsiBios || !stdoutsiBios.vendor || stdoutsiBios.vendor.toString().trim() === '') {
              callback(null, data);
            } else {
              logger.info(`bios : ${JSON.stringify(stdoutsiBios)}`);
              data.bios_vendor = stdoutsiBios.vendor;
              data.bios_version = stdoutsiBios.version;
              si.baseboard((stdoutsiBaseBoard) => {
                if (!stdoutsiBaseBoard || !stdoutsiBaseBoard.manufacturer || stdoutsiBaseBoard.manufacturer.toString().trim() === '') {
                  callback(null, data);
                } else {
                  data.mb_vendor = stdoutsiBaseBoard.manufacturer;
                  data.mb_serial = (stdoutsiBaseBoard.serial) ? (stdoutsiBaseBoard.serial) : null;
                  data.mb_model = stdoutsiBaseBoard.model;
                  data.mb_version = stdoutsiBaseBoard.version;
                  si.battery((stdoutsiBattery) => {
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
    }
    Object.keys(firmwareKeys).forEach((key) => {
      const values = firmwareKeys[key];
      fetch(key, values[0], values[1]);
    });
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
  system.get_as_admin('tpmModule', (err, infoData) => {
    const info = infoData;
    if (err) return cb(err);

    try {
      info.manufacturer_version = info.manufacturerVersion;
      delete info.manufacturerVersion;
    } catch (e) {
      return cb(new Error(`Error getting tpm module info: ${e.message}`));
    }

    return cb(null, info);
  });
};

// eslint-disable-next-line consistent-return
exports.get_recovery_partition_status = (cb) => {
  if (gte(system.os_release, '10.0.0')) {
    const json = {};
    json.available = false;
    system.get_as_admin('recoveryPartition', (err, info) => {
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

exports.get_os_edition = system.get_os_edition;
exports.get_winsvc_version = system.get_winsvc_version;

/* eslint-disable consistent-return */
const { exec } = require('child_process');
const si = require('systeminformation');
const system = require('../../../system/mac/index');

const ramVendors = {
  '0x014F': 'Transcend Information',
  '0x2C00': 'Micron Technology, Inc.',
  '0x802C': 'Micron Technology, Inc.',
  '0x80AD': 'Hynix Semiconductor Inc.',
  '0x80CE': 'Samsung Electronics, Inc.',
  '0xAD00': 'Hynix Semiconductor Inc.',
  '0xCE00': 'Samsung Electronics, Inc.',
};

const parseSystemProfilerProperties = (str) => {
  const obj = {};
  str.toString().split('\n').forEach((line) => {
    if (line !== '') {
      const split = line.split(': ');
      const key = split[0].trim().toLowerCase().replace(/\s/g, '_');
      const val = (split[1] || '').replace(/'/g, '');
      obj[key] = val;
    }
  });
  return obj;
};

const callSystemProfiler = (type, cb, json = false) => {
  const cmd = `/usr/sbin/system_profiler ${type} ${json ? '-json' : ''}`;
  exec(cmd, cb);
};

const getSystemProfilerData = (type, cb) => {
  callSystemProfiler(type, (err, stdout) => {
    if (err) return cb(err);
    const obj = parseSystemProfilerProperties(stdout);
    cb(null, obj);
  });
};

exports.get_firmware_info = (callback) => {
  getSystemProfilerData('SPHardwareDataType', (err, spData) => {
    if (err) return callback(err);
    getSystemProfilerData('SPiBridgeDataType', (errSpi, spiData) => {
      if (errSpi) return callback(errSpi);
      const data = {
        device_type: spData.model_name.indexOf('Book') === -1 ? 'Desktop' : 'Laptop',
        model_name: spData.model_name,
        vendor_name: 'Apple',
        bios_vendor: 'Apple',
        bios_version: spData.boot_rom_version,
        mb_version: (system.is_m1_or_m2()) ? system.get_info_chip() : spData['smc_version_(system)'],
        serial_number: spData['serial_number_(system)'],
        uuid: spData.hardware_uuid,
        apple_security_chip: spiData.ibridge_model_name || '',
      };
      callback(null, data);
    }, true);
  });
};

exports.get_processor_info = system.get_processor_info;

exports.get_ram_module_list = (cb) => {
  const list = [];
  if (system.is_m1_or_m2()) {
    si.mem((stdoutsi) => {
      list.push({
        bank: 'Bank 0',
        size: (stdoutsi.total / 1024) / 1024,
        speed: null,
        vendor: 'Unknown',
        memory_type: null,
        serial_number: null,
      });
      cb(null, list);
    });
  } else {
    callSystemProfiler('SPMemoryDataType', (err, out) => {
      if (err) return cb(err);
      out.toString().split('BANK').forEach((block) => {
        if (!block.match('Size')) return;
        const parts = block.split('\n\n');
        const obj = parseSystemProfilerProperties(parts[1]);
        list.push({
          bank: `Bank${parts[0]}`,
          size: parseInt(obj.size, 10) * 1024,
          speed: parseInt(obj.speed, 10),
          vendor: ramVendors[obj.manufacturer] || 'Unknown',
          memory_type: obj.type,
          serial_number: obj.serial_number,
        });
      });
      cb(null, list);
    });
  }
};

exports.get_prey_user_version = (cb) => {
  system.get_prey_user_version((err, preyUserVersion) => {
    if (err) return cb(err);
    try {
      return cb(null, preyUserVersion);
    } catch (e) {
      return cb(new Error(`Error:${e.message}`));
    }
  });
};

exports.get_osquery_running = (cb) => {
  exec('ps aux | grep "/opt/osquery/lib/osquery.app/Contents/MacOS/osqueryd --flagfile=/private/var/prey/osquery.flags" | grep "^root" | awk \'{print $2}\' | tr -d \'\\n\'', (err, stdout, stderr) => {
    if (err) return cb(null, false, 'osquery_running');
    if (stderr) return cb(null, false, 'osquery_running');
    const matchResult = stdout.match(/\d+/);
    if (matchResult && !Number.isNaN(Number(matchResult[0]))) {
      return cb(null, true, 'osquery_running');
    }
    return cb(null, false, 'osquery_running');
  });
};

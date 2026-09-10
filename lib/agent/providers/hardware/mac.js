/* eslint-disable consistent-return */
// @ts-check
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

/**
 * Parses `system_profiler` plain-text output into a flat key/value map.
 * Keys are lowercased with spaces replaced by underscores.
 * @param {string|Buffer} str
 * @returns {Record<string, string>}
 */
const parseSystemProfilerProperties = (str) => {
  /** @type {Record<string, string>} */
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

/**
 * @param {string} type
 * @param {(err: Error|null, stdout?: string, stderr?: string) => void} cb
 * @param {boolean} [json]
 */
const callSystemProfiler = (type, cb, json = false) => {
  const cmd = `/usr/sbin/system_profiler ${type} ${json ? '-json' : ''}`;
  exec(cmd, { timeout: 30000 }, cb);
};

/**
 * @param {string} type
 * @param {(err: Error|null, data?: Record<string, string>) => void} cb
 * @param {boolean} [json]
 */
const getSystemProfilerData = (type, cb, json = false) => {
  callSystemProfiler(type, (err, stdout) => {
    if (err) return cb(err);
    const obj = parseSystemProfilerProperties(stdout || '');
    cb(null, obj);
  }, json);
};

/**
 * Collects firmware/hardware info via `system_profiler`. Never throws on
 * unexpected/empty output: falls back to `systeminformation` for the model
 * name (and serial/uuid) and always resolves the callback exactly once with
 * the best data available. This is an unattended agent, so a malformed
 * `system_profiler` result must degrade gracefully rather than crash.
 * @param {(err: Error|null, data?: Object) => void} callback
 */
exports.get_firmware_info = (callback) => {
  getSystemProfilerData('SPHardwareDataType', (err, spDataRaw) => {
    if (err) return typeof callback === 'function' && callback(err);
    const spData = spDataRaw || {};
    getSystemProfilerData('SPiBridgeDataType', (errSpi, spiData) => {
      let modelNameSecurityChip = '';
      if (!errSpi && spiData && Object.prototype.hasOwnProperty.call(spiData, 'ibridge_model_name')) {
        modelNameSecurityChip = spiData.ibridge_model_name;
      }

      /**
       * Builds the result and invokes the callback once.
       * @param {string} modelName
       * @param {{ serial?: string, uuid?: string }} [fallback]
       */
      const finish = (modelName, fallback = {}) => {
        const name = modelName || '';
        const data = {
          device_type: name.indexOf('Book') === -1 ? 'Desktop' : 'Laptop',
          model_name: name,
          vendor_name: 'Apple',
          bios_vendor: 'Apple',
          bios_version: spData.boot_rom_version || null,
          mb_version: (system.is_m1_or_m2()) ? system.get_info_chip() : (spData['smc_version_(system)'] || null),
          serial_number: spData['serial_number_(system)'] || fallback.serial || null,
          uuid: spData.hardware_uuid || fallback.uuid || null,
          apple_security_chip: modelNameSecurityChip,
        };
        if (typeof callback === 'function') callback(null, data);
      };

      // Happy path: system_profiler gave us the model name.
      if (spData.model_name) return finish(spData.model_name);

      // model_name missing: fall back to systeminformation without ever
      // crashing or leaving the callback hanging/double-invoked.
      let settled = false;
      /**
       * @param {string} modelName
       * @param {{ serial?: string, uuid?: string }} [fallback]
       */
      const settle = (modelName, fallback) => {
        if (settled) return;
        settled = true;
        finish(modelName, fallback);
      };
      try {
        si.system((info) => {
          const model = info && info.model ? info.model : '';
          settle(model, { serial: info && info.serial, uuid: info && info.uuid });
        });
      } catch (e) {
        settle('', {});
      }
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

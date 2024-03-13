/* eslint-disable consistent-return */
const sudo = require('sudoer');
const { exec } = require('child_process');
const common = require('../../common');

const logger = common.logger.prefix('network');
const airportCmd = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport';
const deprecatedMsg = 'WARNING: The airport command line tool is deprecated and will be removed in a future release.'

const macAddressRegex = /([0-9a-f]{2}[:-]){5}([0-9a-f]{2})/i;

const attemps = 100;
let currentAttemp;

const isAirportWorking = (cb) => {
  sudo(airportCmd, ['-s'], (err, stdout, stderr) => {
    if (err) logger.error(err);
    if (stderr) logger.error(stderr);
    if (stdout && stdout.includes(deprecatedMsg)) {
      return cb(false);
    }
    cb(true);
  });
};

const accessPointsFn = (cmd, args, cb) => {
  if (common.os_release >= '12.0') {
    sudo(cmd, args, (err, stdout, stderr) => {
      if (stderr) logger.error(stderr);
      return cb(err, stdout);
    });
  } else {
    exec(`${cmd} ${args.join(' ')}`, (err, stdout) => {
      if (err) logger.error(err);
      return cb(err, stdout);
    });
  }
};

const getApListRetry = (out, cb) => {
  currentAttemp += 1;
  if (currentAttemp >= attemps) return cb(null, out);
  if (out && out !== '') return cb(null, out);
  isAirportWorking((itWorks) => {
    if (itWorks) {
      accessPointsFn(airportCmd, ['-s'], (err, stdout) => {
        if (err && err.message.includes('No sudo access')) return cb(err);
        getApListRetry(stdout, cb);
      });
    }
  });
};

/**
 * Returns a list of wireless interface names(wlan0, wlan1, etc). It may be empty.
 * */
exports.get_wireless_interfaces_list = (cb) => {
  const cmd = 'networksetup -listallhardwareports | grep Wi-Fi -A1 | grep Device | awk \'{print $NF}\'';
  exec(cmd, (err, out) => {
    if (err) return cb(err);
    cb(null, out.toString().trim().split('\n'));
  });
};

exports.get_active_access_point_mac = (callback) => {
  let output;
  accessPointsFn(airportCmd, ['-I'], (err, stdoutIn) => {
    let stdout = stdoutIn;
    if (err) return callback(err);

    stdout = stdout.toString().split('\n');
    stdout.forEach((line, index) => {
      const data = line.split(': ');
      if (data[0].trim() === 'BSSID') {
        // eslint-disable-next-line prefer-destructuring
        output = data[1];
      }

      if (index === stdout.length - 1) {
        return callback(null, output);
      }
    });
  });
};

exports.get_active_access_point = (callback) => {
  const processActiveAp = (stdout) => {
    if (stdout.includes('AirPort: Off') || !stdout.includes('SSID')) {
      return callback(new Error('Wifi connection unavailable'));
    }

    const out = stdout.split('\n').slice(0, -1);

    const result = {};
    out.forEach((obj) => {
      const values = obj.split(': ');
      result[values[0].trim()] = values[1].trim();
    });

    const ssid = encodeURI(result.SSID);
    const macAddress = result.BSSID;
    const signalStrength = parseInt(result.agrCtlRSSI, 10);
    const channel = parseInt(result.channel, 10);
    const security = result['link auth'];
    const ap = {
      ssid,
      mac_address: macAddress,
      signal_strength: signalStrength,
      channel,
      security,
    };
    callback(null, ap);
  };

  accessPointsFn(airportCmd, ['-I'], (err, stdout) => {
    if (err) return callback(err);
    processActiveAp(stdout);
  });
};

exports.get_access_points_list = (callback) => {
  const processApList = (stdout) => {
    if (stdout.toString().match(/No networks/i)) return callback(new Error('No networks found.'));

    const list = exports.parse_access_points_list(stdout);
    if (list.length > 0) callback(null, list);
    else callback(new Error('No access points found.'));
  };

  currentAttemp = 0;
  getApListRetry(null, (err, stdout) => {
    if (err) return callback(err);
    processApList(stdout);
  });
};

exports.parse_access_points_list = (stdout) => {
  const list = [];
  const lines = stdout.toString().trim().split('\n');

  lines.forEach((line, i) => {
    if (i === 0 || line === '') return;
    const start = line.split(/\s[0-9a-f]{2}[:|-]/); // split on MAC addr start
    if (!start[1]) return;

    const end = start[1].split(/\s[A-Z-]{2}\s/); // split on CC, before security
    const data = end[0].split(/\s+/); // rest of data doesn't contain spaces so we're good
    const sec = end[1] && end[1].trim();

    const ap = {
      ssid: start[0].trim().replace(/[^\w :'-]/g, ''), // remove weird chars
      mac_address: line.match(macAddressRegex)[0],
      signal_strength: parseInt(data[1], 10), // use positive integers
      channel: parseInt(data[2], 10),
      security: (sec === 'NONE') ? false : sec,
    };

    if (ap.ssid && ap.mac_address) list.push(ap);
  });

  return list;
};

exports.get_active_interface = (cb) => {
  const cmd = 'netstat -rn | grep UG | awk \'{print $4}\'';
  exec(cmd, (err, stdout) => {
    if (err) return cb(err);

    const raw = stdout.toString().trim().split('\n');
    if (raw.length === 0 || raw.every((r) => r === '')) return cb(new Error('No active network interface found.'));
    cb(null, raw[0]);
  });
};

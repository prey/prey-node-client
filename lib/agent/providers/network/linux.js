/* eslint-disable consistent-return */
/* eslint-disable camelcase */
/// ///////////////////////////////////////
// Prey JS Network Module Linux Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
/// ///////////////////////////////////////

const { exec } = require('child_process');
const sudo = require('sudoer');
const common = require('../../common');

const logger = common.logger.prefix('network-linux');
const MIN_APS_FOR_CACHED_RESULT = 4;
const RESCAN_COOLDOWN_MS = 30000;
const RESCAN_WAIT_MS = 4000;

let lastForcedRescanAt = 0;

const NMCLI_LIST_CMD = 'sudo nmcli -t -f BSSID,SSID,CHAN,SIGNAL,SECURITY device wifi list';
const NMCLI_RESCAN_CMD = 'sudo nmcli device wifi rescan';

const runNmcliList = (callback) => {
  exec(NMCLI_LIST_CMD, callback);
};

const runNmcliRescan = (callback) => {
  exec(NMCLI_RESCAN_CMD, callback);
};

const get_first_wireless_interface = function (callback) {
  exports.get_wireless_interfaces_list((err, list) => {
    if (err || !list[0]) return callback(err || new Error('No wireless interfaces found.'));

    callback(null, list[0]);
  });
};

/**
 * Returns a list of wireless interface names (wlan0, wlan1, etc). It may be empty.
 * */
exports.get_wireless_interfaces_list = function (callback) {
  const cmd = "iwconfig 2>&1 | grep -v 'no wireless' | grep '802.11' | cut -f1 -d' ' | sed '/^$/d'";

  exec(cmd, (err, stdout) => {
    if (err) {
      logger.error(`get_wireless_interfaces_list error: ${err.message}`);
      return callback(err);
    }

    const list = stdout.toString().trim();

    if (list == '') {
      return callback(new Error('No wireless interfaces found.'));
    }

    const interfaces = list.split('\n');
    callback(null, interfaces);
  });
};

/**
 * Returns the MAC address of the active access point.
 * */
exports.get_active_access_point_mac = function (callback) {
  const cmd = "iwconfig 2>&1 | grep 'Access Point' | awk '{print $6}'";
  exec(cmd, (err, stdout) => {
    if (err) return callback(err);

    const raw = stdout.toString().trim();

    if (raw === '' || raw === 'dBm' || raw === 'Not-Associated') return callback(new Error('No active access point found.'));

    callback(null, raw);
  });
};

exports.get_active_access_point = function (callback) {
  // There's not enough information using the command related
  // to the current AP, so we need to consult the AP list.
  // TODO: Optimize the AP list command usage.
  exports.get_active_access_point_mac((err, ap_mac) => {
    if (err || !ap_mac) return callback(err || new Error('No active access point found.'));

    exports.get_access_points_list((err, aps) => {
      if (err) return callback(err);

      const padded_mac = ap_mac.toString().trim().replace(/(^|:)(?=[0-9a-fA-F](?::|$))/g, '$10');

      try {
        var aps = aps.filter((ap) => ap.mac_address === padded_mac);
      } catch (e) {
        return callback(new Error('Could not find matching access point'));
      }

      if (aps.length > 0) {
        callback(null, aps[0]);
      } else {
        callback(new Error(`Could not find matching access point for${padded_mac}`));
      }
    });
  });
};

exports.getAcessPointAlternative = (callback, attempt = 1) => {
  // eslint-disable-next-line consistent-return
  get_first_wireless_interface((err, wifiDevice) => {
    if (err || !wifiDevice) {
      logger.error(`getAcessPointAlternative: no wireless interface — ${err}`);
      return callback(new Error(err || 'No wireless adapter found.'));
    }
    // eslint-disable-next-line consistent-return
    sudo('iwlist', [wifiDevice, 'scan'], (errIwlist, stdout, stderr) => {
      if (stderr) logger.debug(`iwlist stderr: ${stderr.toString().trim()}`);
      if (attempt < 5 && stderr && stderr.match('resource busy')) {
        return setTimeout(() => {
          exports.getAcessPointAlternative(callback, attempt + 1);
        }, 3000);
      }
      if (errIwlist) {
        logger.error(`iwlist scan error: ${errIwlist.message || errIwlist}`);
        return callback(errIwlist);
      }
      if (stdout === '') {
        logger.error('iwlist scan returned empty output');
        return callback(new Error('iwlist returned empty output'));
      }

      const list = exports.parse_access_points_list(stdout.toString());

      if (list && list.length > 0) callback(null, list);
      else callback(new Error('No access points detected.'));
    });
  });
};

/// //////////////////////////////////////////////////////////////
// access points list fetcher and parser
/// //////////////////////////////////////////////////////////////

/**
 * Gets access points list using iwlist (requires wireless-tools package).
 * @param {String} wifi_device
 * */
// eslint-disable-next-line consistent-return
exports.get_access_points_list = (callback, attempt, useNmcli = true) => {
  if (!useNmcli) {
    return exports.getAcessPointAlternative(callback, attempt);
  }

  const parseNmcliOutput = (stdout) => {
    const rawOutput = stdout.trim();
    const lines = rawOutput.split('\n').filter((line) => line.trim().length > 0);

    const headers = ['mac_address', 'ssid', 'channel', 'signal_strength', 'security'];
    const wifiList = [];
    const separatorRegex = /(?<!\\):/;

    lines.forEach((line) => {
      const columns = line.split(separatorRegex);
      if (columns.length !== headers.length) {
        return;
      }

      const network = {};
      headers.forEach((header, index) => {
        let value = columns[index].trim();

        if (header === 'signal_strength') {
          const signalPercent = Number.parseInt(value, 10);
          value = Math.floor((signalPercent / 2) - 100);
        }
        if (header === 'channel') {
          value = Number.parseInt(value, 10);
        }
        if (header === 'ssid' && value === '') {
          value = '(Unknown)';
        }
        if (header === 'mac_address') {
          value = value.replace(/\\/g, '');
        }
        network[header] = value;
      });
      wifiList.push(network);
    });

    return wifiList;
  };
  // eslint-disable-next-line consistent-return
  runNmcliList((err, stdout, stderr) => {
    if (stderr) {
      logger.debug(`nmcli stderr (informational): ${stderr.toString().trim()}`);
    }
    if (err) {
      return exports.getAcessPointAlternative(callback, attempt);
    }

    const list = parseNmcliOutput(stdout);

    const shouldRescanByCount = list.length < MIN_APS_FOR_CACHED_RESULT;
    const now = Date.now();
    const cooldownActive = now - lastForcedRescanAt < RESCAN_COOLDOWN_MS;

    if (!shouldRescanByCount) {
      return callback(null, list);
    }

    if (cooldownActive) {
      return callback(null, list);
    }

    // Low AP count from cache — force a fresh scan and retry once
    lastForcedRescanAt = now;
    runNmcliRescan(() => {
      // Wait for the scan to complete before fetching the new list
      setTimeout(() => {
        runNmcliList((err2, stdout2) => {
          if (err2) {
            return exports.getAcessPointAlternative(callback, attempt);
          }

          const freshList = parseNmcliOutput(stdout2);
          const finalList = freshList.length >= list.length ? freshList : list;

          if (freshList.length < list.length) {
            // Preserve the previous list if the fresh scan regresses.
          }

          if (finalList.length === 0) {
            return exports.getAcessPointAlternative(callback, attempt);
          }

          return callback(null, finalList);
        });
      }, RESCAN_WAIT_MS);
    });
  });
};

exports.parse_access_points_list = function (output) {
  return output.split(/Cell \d\d - /).splice(1).map((block) => {
    const parsed = {};

    block.split('\n').forEach((line) => {
      const match = line.match(/^\s*(.+?)[:|=](.*)$/);
      if (match) {
        parsed[match[1]] = (match[2] || '').trim();
      }
    });

    if (!parsed.ESSID) return;

    const obj = {
      ssid: parsed.ESSID.slice(1, -1).replace(/[^\w :'-]/g, ''), // remove "" and weird chars,
      mac_address: parsed.Address,
      security: parsed['Encryption key'] == 'on',
    };

    // if it has security, and there's a IE param that does not contain 'Unknown', read it
    if (obj.security === true && parsed.IE && parsed.IE.indexOf('Unknown') === -1) {
      obj.security = parsed.IE.replace('IEEE 802.11i/', '').trim();
    }

    // if we have signal level, cut the first part since the format is 77/100
    if (parsed['Signal level']) {
      obj.signal_strength = parseInt(parsed['Signal level'].split('/')[0], 10);
    } else if (parsed.Quality) {
      // oh, it looks like this is an old version. then get the level from the Quality section
      const signal = parsed.Quality.match(/Signal level.([0-9\/\-]*) ?dBm([^"{]*)/);
      if (signal) obj.signal_strength = parseInt(signal[1], 10);
    }

    return obj;

  // remove empty elements from array
  }).filter((el) => !!el);
};

exports.isWifiPermissionActive = (callback) => {
  callback();
};

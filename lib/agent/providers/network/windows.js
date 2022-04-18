/* eslint-disable linebreak-style */

/// ///////////////////////////////////////
// Prey JS Network Module Windows Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
/// ///////////////////////////////////////

const wmic = require('wmic');
const { exec } = require('child_process');
const os = require('os');
const si = require('systeminformation');
const common = require('../../common');

const release = parseFloat(os.release());

/**
 * Callsback a list of wireless adapter names.
 * */
exports.get_wireless_interfaces_list = function(callback) {
  var query = 'nic where "Name like \'%Wireless%\'" get NetConnectionID';
 
    wmic.run(query, function(err, o) {
      if (err) {
        si.networkInterfaceDefault((defaultNetwork) => {
          callback(null, defaultNetwork);
        }) 
      }
      else{
        var list = o.split("\n").splice(1).map(function(n) { return n.trim(); });
        callback(null, list);
      }
    }); 
};

/**
 * Returns the MAC address of the active access point.
 * */
exports.get_active_access_point_mac = (callback) => {
  if (release >= 6.0) {
    // eslint-disable-next-line consistent-return
    exec('netsh wlan show interfaces', (err, stdout) => {
      if (err) return callback(err);

      const bssid = stdout.toString().match(/BSSID\s+:\s?(.+)/);
      if (bssid) {
        callback(null, bssid[1]);
      } else {
        callback(null, '');
      }
    });
  } else {
    callback(new Error('TODO!'));
  }
};

exports.get_active_access_point = (callback) => {
  if (release >= 6.0) {
    // eslint-disable-next-line consistent-return
    exec('netsh wlan show interfaces', (error, stdout) => {
      if (error) return callback(error);
      if (!stdout.includes('SSID')) return callback(new Error('Wifi connection unavailable'));
      try {
        const info = stdout.split('\n');
        const ssid = escape(stdout.toString().match(/SSID\s+:\s?(.+)/)[1]);
        const mac_address = stdout.toString().match(/BSSID\s+:\s?(.+)/)[1];
        const ss = info[18].toString().match(/\s+:\s?(.+)/)[1].trim();

        // Verify info from command output
        if (ss.slice(-1) === '%') {
          const signal_strength = parseInt(ss, 10) - 100;
          const channel = parseInt(info[15].toString().match(/\s+:\s?(.+)/)[1], 10);
          const security = info[12].toString().match(/\s+:\s?(.+)/)[1];

          const ap = {
            ssid, mac_address, signal_strength, channel, security,
          };
          callback(null, ap);

        // When the data isn't consistent we're using the old method
        } else {
          // eslint-disable-next-line consistent-return
          exports.get_access_points_list((err, aps) => {
            if (err) return callback(err);

            const paddedMac = mac_address.toString().trim().replace(/(^|:)(?=[0-9a-fA-F](?::|$))/g, '$10');

            const apsFiltered = aps.filter((ap) => ap.mac_address === paddedMac);

            if (apsFiltered.length > 0) {
              callback(null, apsFiltered[0]);
            } else callback(new Error(`Could not find matching access point for ${paddedMac}`));
          });
        }
      } catch (e) {
        callback(new Error('Unable to get current ap.'));
      }
    });
  } else {
    callback(new Error('TODO!'));
  }
};

/// //////////////////////////////////////////////////////////////
// access points list fetcher and parser
/// //////////////////////////////////////////////////////////////

/**
 * Gets access points list
 * @param {String} wifi_device - should return something like
 * { ssid:"",security:true,quality:23,signal_strength:54,noise_level:24}
 *
 * autowc actually returns {mac_address,ssid,signal_strength,channel,signal_to_noise}
 * this function converts
 * */

exports.get_access_points_list = (callback) => {
  let cmd;
  let parser;
  let list = [];

  // eslint-disable-next-line consistent-return
  const done = (err) => {
    if (err || list.length === 0) {
      if (!err) callback(new Error('No access points found.'));
      if (err.code === 10) callback('No Wi-Fi adapter found');
      callback(err);
      // const e = !err ? new Error('No access points found.')
      // : err.code == 10 ? 'No Wi-Fi adapter found' : err;
      // callback(e);
    } else {
      callback(null, list);
    }
  };

  if (release <= 5.2) {
    cmd = 'autowcxp -list';
    parser = 'autowc';
  } else {
    cmd = 'netsh wlan show all';
    parser = 'netsh';
  }

  exec('chcp 65001', () => {
    common.system.scan_networks(() => {
      // eslint-disable-next-line consistent-return
      exec(cmd, (err, out) => {
        if (err) return done(err);
        list = exports[`parse_access_points_list_${parser}`](out);
        done();
      });
    });
  });
};

exports.parse_access_points_list_autowc = (out) => {
  let arr = [];
  try {
    arr = JSON.parse(`[${out}]`);
  } catch (e) {
    return arr;
  }

  if (arr.length === 0) return [];

  return arr.map((o) => ({
    ssid: o.ssid.replace(/[^\w :'-]/g, ''),
    // security     : null, // don't have this data
    // quality      : null,
    signal_strength: o.signal_strength,
    noise_level: o.signal_to_noise,
  }));
};

/* example output:

SSID 1 : SomewhereWiFi
    Network type            : Infrastructure
    Authentication          : Open
    Encryption              : None
    BSSID 1                 : aa:bb:cc:11:22:33
         Signal             : 38%
         Radio type         : 802.11n
         Channel            : 6
         Basic rates (Mbps) : 1 2 5.5 11
         Other rates (Mbps) : 6 9 12 18 24 36 48 54
    BSSID 2                 : 33:22:11:bb:cc:dd
         Signal             : 40%
         Radio type         : 802.11n
         Channel            : 4
         Basic rates (Mbps) : 1 2 5.5 11
         Other rates (Mbps) : 6 9 12 18 24 36 48 54

*/

exports.parse_access_points_list_netsh = (out) => {
  // eslint-disable-next-line prefer-const
  let list = [];
  const blocks = out.split(/\nSSID \d{1,2}\s:/);

  if (!blocks) return [];

  const getValues = (str) => {
    // eslint-disable-next-line prefer-const
    let res = {};
    let idx = 0;
    str.split('\n').forEach((line) => {
      if (line.toString().trim() === '') return;

      const split = line.split(': ');
      const key = idx.toString();
      const val = split[1] ? split[1].trim() : null;

      if (key) res[key] = val;
      idx += 1;
    });
    return res;
  };

  const SSID_KEYS = {
    SSID: '0',
    AUTH: '2',
  };

  const BSSID_KEYS = {
    BSSID: '0',
    SIGNAL: '1',
    CHANNEL: '3',
  };

  const buildAp = (base, router) => {
    const obj = {
      ssid: (!base[SSID_KEYS.SSID] || base[SSID_KEYS.SSID].toString().trim() === '') ? '(Unknown)' : base['0'],
      security: base[SSID_KEYS.AUTH] !== 'Open' ? base[SSID_KEYS.AUTH] : null,
      mac_address: router[BSSID_KEYS.BSSID],
    };

    // signal is shown as '94%', so we need to substract 100 to get a consistent behaviour with
    // OSX and Linux's signal_strength integer
    // eslint-disable-next-line max-len
    if (router[BSSID_KEYS.SIGNAL]) obj.signal_strength = parseInt(router[BSSID_KEYS.SIGNAL], 10) - 100;

    if (router[BSSID_KEYS.CHANNEL])obj.channel = parseInt(router[BSSID_KEYS.CHANNEL], 10);

    return obj;
  };

  blocks.forEach((block, i) => {
    if (i === 0) return; // first block contains data about the interface and card

    // netsh groups access points by BSSID, so we need to separate each
    // SSID block into the BSSID it contains and select one of them
    const routers = block.split(/[BSSID BSSIDD] \d/);

    // the first block will contain shared information: SSID, auth, encryption
    // so parse those values first. insert the SSID part that was removed from line one
    const shared = `SSID : ${routers.shift()}`;
    const main = getValues(shared);

    const routersMapped = routers.map((routerData) => {
      const values = getValues(`BSSID${routerData}`);

      if (!values[BSSID_KEYS.BSSID] || values[BSSID_KEYS.BSSID].toString().trim() === '') return;

      // eslint-disable-next-line consistent-return
      return values;
    }).filter((el) => el); // remove invalid entries

    // console.log(main['SSID'] + ' has ' + routers.length + ' routers.');
    routersMapped.forEach((router) => {
      list.push(buildAp(main, router));
    });
  });

  return list;
};

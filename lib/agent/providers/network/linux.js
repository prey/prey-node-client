"use strict";

//////////////////////////////////////////
// Prey JS Network Module Linux Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec   = require('child_process').exec,
    sudo   = require('sudoer');

exports.get_first_wireless_interface = function(callback){
  exports.get_wireless_interfaces_list(function(err, list) {
    if (err || !list[0])
      return callback(err || new Error('No wireless interfaces found.'));

    callback(null, list[0]);
  });
};

/**
 * Returns a list of wireless interface names (wlan0, wlan1, etc). It may be empty.
 **/
exports.get_wireless_interfaces_list = function(callback) {
  var cmd = "iwconfig 2>&1 | grep -v 'no wireless' | grep '802.11' | cut -f1 -d' ' | sed '/^$/d'";
  exec(cmd, function(err, stdout){
    if(err) return callback(err);

    var list = stdout.toString().trim();

    if (list == '')
      return callback(new Error('No wireless interfaces found.'))

    callback(null, list.split('\n'));
  });
};

/**
 * Returns the MAC address of the active access point.
 **/
exports.get_active_access_point_mac = function(callback) {
  var cmd = "iwconfig 2>&1 | grep 'Access Point' | awk '{print $6}'";
  exec(cmd, function(err, stdout){
    if (err) return callback(err);

    var raw = stdout.toString().trim();

    if (raw === '' || raw === 'dBm' || raw === "Not-Associated")
      return callback(new Error('No active access point found.'));

    callback(null, raw);
  });
};

exports.get_active_access_point = function(callback) {
  // There's not enough information using the command related to the current AP, so we need to consult the AP list.
  // TODO: Optimize the AP list command usage.
  exports.get_active_access_point_mac((err, ap_mac) => {
    if (err || !ap_mac) return callback(err || new Error('No active access point found.'));

    exports.get_access_points_list((err, aps) => {
      if (err) return callback(err);

      var padded_mac = ap_mac.toString().trim().replace(/(^|:)(?=[0-9a-fA-F](?::|$))/g, "$10");

      try {
        aps = aps.filter(function(ap) {
          return ap.mac_address === padded_mac;
        });
      } catch (e) {
        return callback(new Error('Could not find matching access point'));
      }

      if (aps.length > 0) {
        callback(null, aps[0]);
      } else {
        callback(new Error('Could not find matching access point for' + padded_mac));
      }

    })
  })
}

/////////////////////////////////////////////////////////////////
// access points list fetcher and parser
/////////////////////////////////////////////////////////////////

/**
 * Gets access points list using iwlist (requires wireless-tools package).
 * @param {String} wifi_device
 **/
exports.get_access_points_list = function(callback, attempt) {
  exports.get_first_wireless_interface(function(err, wifi_device) {
    if (err || !wifi_device)
      return callback(new Error(err || 'No wireless adapter found.'));

    sudo('iwlist', [wifi_device, 'scan'], function(err, stdout, stderr) {
      if (!attempt || attempt < 5 && (stderr && stderr.match('resource busy'))) {
        return setTimeout(function() {
          exports.get_access_points_list(callback, (attempt || 1)+1);
        }, 3000);
      } else if (err || stdout === '') {
        return callback(err);
      }

      var list = exports.parse_access_points_list(stdout.toString());

      if (list && list.length > 0)
        callback(null, list);
      else
        callback(new Error('No access points detected.'));
    });

  });

};

exports.parse_access_points_list = function(output) {

  return output.split(/Cell \d\d - /).splice(1).map(function(block) {
    var parsed = {};

    block.split('\n').forEach(function(line) {
      var match = line.match(/^\s*(.+?)[:|=](.*)$/);
      if (match) {
        parsed[match[1]] = (match[2] || '').trim();
      }
    })

    if (!parsed['ESSID'])
      return;

    var obj = {
      ssid:        parsed['ESSID'].slice(1, -1).replace(/[^\w :'-]/g, ''), // remove "" and weird chars,
      mac_address: parsed['Address'],
      security:    parsed['Encryption key'] == 'on'
    }

    // if it has security, and there's a IE param that does not contain 'Unknown', read it
    if (obj.security === true && parsed['IE'] && parsed['IE'].indexOf('Unknown') === -1) {
      obj.security = parsed['IE'].replace('IEEE 802.11i/', '').trim();
    }

    // if we have signal level, cut the first part since the format is 77/100
    if (parsed['Signal level']) {
      obj.signal_strength = parseInt(parsed['Signal level'].split('/')[0]);
    } else if (parsed['Quality']) {
      // oh, it looks like this is an old version. then get the level from the Quality section
      var signal = parsed['Quality'].match(/Signal level.([0-9\/\-]*) ?dBm([^"{]*)/);
      if (signal) obj.signal_strength = parseInt(signal[1]);
    }

    return obj;

  // remove empty elements from array
  }).filter(function(el) { return !!el })

};

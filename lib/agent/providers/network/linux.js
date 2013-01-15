
"use strict";

//////////////////////////////////////////
// Prey JS Network Module Linux Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec = require('child_process').exec,
    system = require('./../../common').system,
    sudo   = system.sudo;

/**
 * Check if there's a wifi network interface.
 * iwgetid returns 0 if wifi exists, 225 if no wifi
 **/
var have_wifi = function(cb) {
  exec('iwgetid', function(err) {
    if (err)
      return err.code === 255 ? cb(null, false) : cb(err);

    callback(null, true);
  });
};

/**
 * If no wifi, then there is no error but callbacked get's a null in second param.
 **/
exports.get_active_network_interface_name = function(callback) {
  var cmd = "netstat -rn | grep UG | awk '{print $NF}'";
  exec(cmd, function(err, stdout) {
    if (err) return callback(err);

    var raw = stdout.toString().trim().split('\n');
    if (raw.length === 0 || raw === [''])
      return callback(new Error('No active network interface found.'));

    callback(null, raw[0]);
  });
};


/**
 * Returns a list of wireless interface names (wlan0, wlan1, etc). It may be empty.
 **/
exports.get_wireless_interface_names = function(callback) {
  var cmd = "iwconfig 2>&1 | grep -v 'no wireless' | cut -f1 -d' ' | sed '/^$/d'";
  exec(cmd, function(err, stdout){
    if(err) return callback(err);

    var list = stdout.toString().trim().split('\n');
    callback(null, list);
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


exports.gateway_ip_for = function(nic_name, cb){
  exec("ip r | grep " + nic_name + " | grep default | cut -d ' ' -f 3", cb);
}

/**
 * @param {String} nic_name
 **/
exports.broadcast_address_for = function(nic_name, callback){
  var cmd = "ifconfig | grep " + nic_name + " -A1 | awk '/Bcast/ {print $3}'";
  exec(cmd, function(err, stdout){
    if (err) return callback(err);

    var out = stdout.toString(),
        broadcast = (out !== '') && out.replace('Bcast:', '').split("\n")[0];

    callback(null, broadcast);
  });
};

/////////////////////////////////////////////////////////////////
// access points list fetcher and parser
/////////////////////////////////////////////////////////////////

/**
 * Gets access points list using iwlist (requires wireless-tools package).
 * @param {String} wifi_device
 **/
exports.access_points_list = function(wifi_device, callback) {

  if (!wifi_device || wifi_device === '')
    return callback(new Error('Wifi device required.'));

  sudo('iwlist', [wifi_device, 'scan'], function(err, stdout) {
    if (err || stdout === '') return callback(err);

    var list = exports.parse_access_points_list(stdout.toString());
    if (list && list.length > 0)
      callback(null, list)
    else
      callback(new Error('No access points detected.'));
  });

};

exports.parse_access_points_list = function(output){
  return output.trim()
        .split(/Cell \d\d - /)
        .splice(1)
        .map(function(block) {
          return block.split(/\n/)
          .filter(function(line) { return line.trim().length > 0; })
          .reduce(function(o, line) {
            var m = line.match(/^\s*(.+?)[:|=](.*)$/);
            if (!m) {
              // logger.warn('Parser not recognising wifi output');
              return o;
            }
            switch (m[1]) {
              case "ESSID":
                o.ssid = m[2].slice(1,-1); // remove ""
                break;
              case "Address":
                o.mac_address = m[2].trim();
                break;
              case "Encryption key":
                o.security = (m[2].trim() === "on") ? true : false;
                break;
              case "Quality":
                o.quality = m[2].substr(0, 2);
                var signal = m[2].match(/Signal level.([0-9\/\-]*) ?dBm([^"{]*)/);
                o.signal_strength = (signal) ? parseInt(signal[1]) : null;
                var noise = m[2].match(/Noise level.([0-9\/\-]*) ?dBm([^"{]*)/);
                o.noise_level = (noise) ? noise[1] : null;
                break;
            }
            return o;
          }, { security: false });
        });
};

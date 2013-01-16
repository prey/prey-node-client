"use strict";

//////////////////////////////////////////
// Prey JS Network Module Windows Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var system = require('./../../common').system,
    wmic   = system.wmic,
    exec   = require('child_process').exec,
    os     = require("os");

/**
 * Callsback a nic name.
 **/
exports.get_active_network_interface_name = function(callback) {
  var query = 'path Win32_NetworkAdapter' +
              ' where "NetConnectionStatus = 2"' +
              ' get Name';

  wmic.run(query, function(err, out) {
    if (err) return callback(err);
    callback(null, out.split("\n")[1].trim());
  });
};

/**
 * Callsback a list of wireless adapter names.
 **/
exports.get_wireless_interface_names = function(callback) {
  var query = 'path Win32_NetworkAdapter ' +
              'where "Name like \'%Wireless%\'" get NetConnectionID';
  wmic.run(query,function(err, o) {
    if (err) return callback(err);

    callback(null, o.split("\n").splice(1).map(function(n) { return n.trim(); }));
  });
};

/**
 * Returns the MAC address of the active access point.
 **/
exports.get_active_access_point_mac = function(callback) {
  var release = os.release()
  if (parseFloat(release) < 6.0) {
    exec("netsh wlan show interfaces", function(err, stdout, stderr) {
      if (err) return callback(err);
      callback(new Error('TODO!'));
    });
  } else {
    callback(new Error('TODO!'));
  }
  //callback(null, o.split("\n").splice(1).map(function(n) { return n.trim(); }));
};

exports.gateway_ip_for = function(nic_name, cb){
  cb(new Error('TODO!'));
}

/**
 * ! TODO Change this appropriately.
 * System Key: [HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\[Adapter Name]\
 * Parameters\Tcpip]
 * Value Name: UseZeroBroadcast
 * Data Type: REG_DWORD (DWORD Value)
 * Value Data: (0 = default, 1 = use 0.0.0.0 broadcast)
 **/

exports.broadcast_address_for = function(nic_name, callback){
  callback(new Error('TODO!'));
};


/////////////////////////////////////////////////////////////////
// access points list fetcher and parser
/////////////////////////////////////////////////////////////////

/**
 * Gets access points list
 * @param {String} wifi_device - should return something like
 * { ssid:"",security:true,quality:23,signal_strength:54,noise_level:24}
 *
 * autowc actually returns {mac_address,ssid,signal_strength,channel,signal_to_noise} this function converts
 **/

exports.access_points_list = function(wifi_device, callback) {

  if (!wifi_device || wifi_device === '')
    return callback(new Error('Wifi device required.'));

  system.get_os_version(function(err, ver) {
    if (err) return callback(err);

    if (ver === "XP") {
      exec("autowcxp -list", function(err, stdout, stderr) {
        if (err) return callback(err);

        var list = exports.parse_access_points_list("[" + stdout + "]");

        if (list.length > 0) {
          callback(null, list);
        } else {
          callback(new Error("No access points found."));
        }
      });
    } else {
      exec("netsh wlan show all", function(err, stdout, stderr) {
        if (err) return callback(err);

        var accesspoints = stdout.match(/SSID \d{1,2} : ((.|\r\n)*)/g);
        var returned_wlan_list = [];

        var linecount = null;
        var repeatable = null;

        var current_ssid = null;
        var current_authentication_type = null;
        var current_bssid = null;
        var current_signal = null;
        var current_channel = null;
        var current_wlan = null;

        accesspoints[0].split("\r\n\r\n").forEach(function(ap) {
          linecount = 0;
          repeatable = false;
          current_ssid = "";
          current_authentication_type = "";

          ap.split("\r\n").forEach(function(line) {
            if (line.match(/BSSID (\d{1,2})/)) {
              repeatable = true;
              linecount = 0;
            }

            if (repeatable == false) {
              if (linecount == 0) {
                current_ssid = line.split(":")[1];
              } else if (linecount == 2) { 
                current_authentication_type = line.split(":")[1];
              }
            } else {
              if (linecount == 0) {
                current_bssid = line.split(" : ")[1];
              } else if (linecount == 1) {
                current_signal = line.split(" : ")[1];
              } else if (linecount == 3) {
                current_channel = line.split(" : ")[1];
              } else if (linecount == 4) {
                if (current_ssid != null) {
                  current_wlan = {
                    ssid: current_ssid.trim(),
                    mac_address: current_bssid.trim(),
                    signal_strength: parseInt(current_signal.replace("%", "").trim()) - 100,
                    channel: parseInt(current_channel.trim()),
                    signal_to_noise: 0,
                    security: current_authentication_type.trim() === "Open" ? false : current_authentication_type.trim()
                  }
                  returned_wlan_list.push(current_wlan);
                }
                current_bssid = null;
                current_signal = null;
                current_channel = null;
              }
            }

            linecount++;
          });
        });

        if (linecount == null) {
          callback(new Error("No access points found."));
        } else {
          callback(null, returned_wlan_list);
        }
      });
    }
  });
};

exports.parse_access_points_list = function(out){

  var arr = [];
  try { arr = JSON.parse(out) }
  catch(e) { return arr; };

  if (arr.length === 0)
    return [];

  return arr.map(function(o) {
    return {
      ssid: o.ssid,
      security: null, // don't have this data
      quality: null,
      signal_strength: o.signal_strength,
      noise_level: o.signal_to_noise
    };
  })

}

"use strict";

//////////////////////////////////////////
// Prey JS Network Module Windows Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var system   = require('./../../common').system,
    hardware = require('./../hardware'),
    wmic     = system.wmic,
    exec     = require('child_process').exec,
    os       = require("os");

var get_wmic_ip_value = function(what, nic_name, cb){

  hardware.mac_address_for(nic_name, function(err, mac){
    if (err || !mac)
      return cb(err || new Error('No MAC Address found.'));

    wmic.get_value('nicconfig', what, 'MACAddress = \'' + mac + '\'', function(err, out){
      if (err) return cb(err);

      cb(null, out.split(',')[0].replace(/[^0-9\.]/g, ''));
    });
  })

}

/**
 * Callsback a nic name.
 **/
exports.get_active_network_interface_name = function(cb) {
  wmic.get_value('nic', 'NetConnectionID', 'NetConnectionStatus = 2', cb);
};

/**
 * Callsback a list of wireless adapter names.
 **/
exports.get_wireless_interfaces_list = function(callback) {
  var query = 'nic where "Name like \'%Wireless%\'" get NetConnectionID';
  wmic.run(query, function(err, o) {
    if (err) return callback(err);

    var list = o.split("\n").splice(1).map(function(n) { return n.trim(); });
    callback(null, list);
  });
};

/**
 * Returns the MAC address of the active access point.
 **/
exports.get_active_access_point_mac = function(callback) {
  var release = os.release();
  if (parseFloat(release) > 6.0) {
    exec("netsh wlan show interfaces", function(err, stdout) {
      if (err) return callback(err);

      var bssid = stdout.toString().match(/BSSID\s+:\s?(.+)/);
      if (bssid) {
        callback(null, bssid[1]);
      } else {
        callback(new Error('No active access point(s) found.'))
      }
    });
  } else {
    callback(new Error('TODO!'));
  }
};

exports.netmask_for = function(nic_name, cb){
  get_wmic_ip_value('IPSubnet', nic_name, cb);
};

exports.gateway_ip_for = function(nic_name, cb){
  get_wmic_ip_value('DefaultIPGateway', nic_name, cb);
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

exports.get_access_points_list = function(callback) {

  var list = [],
      release = parseFloat(os.release());

  var done = function(err){
    if (err || list.length == 0) {
      var e = !err ? new Error("No access points found.")
                   : err.code == 10 ? 'No Wi-Fi adapter found' : err;
      callback(e);
    } else {
      callback(null, list);
    }
  }

  if (release <= 5.2) {
    var cmd = 'autowcxp -list',
        parser = 'autowc';
  } else {
    var cmd = 'netsh wlan show all',
        parser = 'netsh';
  }

  exec(cmd, function(err, out){
    if (err) return done(err);
    list = exports['parse_access_points_list_' + parser](out);
    done();
  })

};

exports.parse_access_points_list_autowc = function(out){

  var arr = [];
  try { arr = JSON.parse("[" + out + "]") }
  catch(e) { return arr; };

  if (arr.length === 0)
    return [];

  return arr.map(function(o) {
    return {
      ssid: o.ssid,
      security: null, // don't have this data
      // quality: null,
      signal_strength: o.signal_strength,
      noise_level: o.signal_to_noise
    };
  })

}

exports.parse_access_points_list_netsh = function(output){

  var accesspoints = output.match(/SSID \d{1,2} : ((.|\r\n)*)/g);
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

  return returned_wlan_list;

};

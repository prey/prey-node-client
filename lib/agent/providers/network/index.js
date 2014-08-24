"use strict";

//////////////////////////////////////////
// Prey JS Network Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

// this provider provides relevant network info that by definition may change
// at any given moment (IP address, Wifi network, etc), so we should not
// use memoize on them, unlike the function from the hardware provider.

var network      = require('network'),
    os_name      = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    os_functions = require('./' + os_name),
    exp = module.exports;

/////////////////////////////////////////////////////////////////
// getters
/////////////////////////////////////////////////////////////////

exp.get_public_ip = network.get_public_ip;

exp.get_private_ip = network.get_private_ip;

exp.get_gateway_ip = network.get_gateway_ip;

exp.get_active_network_interface = network.get_active_interface;

/////////////////////////////////////////////////////////////////
// wifi getters
/////////////////////////////////////////////////////////////////

/**
 * Callsback an array of wireless interface names
 **/
exp.get_wireless_interfaces_list = os_functions.get_wireless_interfaces_list;

/**
 *
 **/
exp.get_access_points_list = function(callback){

  os_functions.get_access_points_list(function(err, list){
    if (err || !list)
      return callback(err || new Error('No access points found.'))

    // sort them from the nearest to the farthest
    list.sort(function(a, b){
      return b.signal_strength - a.signal_strength;
    });

    return callback(null, list);
  });

};

/**
 * Callsback an AP object of the one that the device is connected to.
 **/
exp.get_active_access_point = function(callback){

  os_functions.get_active_access_point_mac(function(err, ap_mac) {
    if (err || !ap_mac)
      return callback(err || new Error('No active access point found.'));

    exp.get_access_points_list(function(err, aps) {
      if (err) return callback(err);

      var padded_mac = ap_mac.toString().trim().replace(/(^|:)(?=[0-9a-fA-F](?::|$))/g, "$10");

      var aps = aps.filter(function(ap) {
        return ap.mac_address === padded_mac;
      });

      if (aps.length > 0) {
        callback(null, aps[0]);
      } else {
        callback(new Error('Could not find matching access point for' + padded_mac));
      }

    });
  });

};

exp.get_active_access_point_name = function(callback){

  exp.get_active_access_point(function(err, ap){
    if (err || !ap || !ap.ssid || ap.ssid.trim() == '')
      return callback(err || new Error('No active access point found.'));

    callback(null, ap.ssid);
  });

};


/**
 * Callback an array of open access points, sorted by signal strength.
 * If none exist, return the empty array.
 **/
exp.get_open_access_points_list = function(callback){

  exp.get_access_points_list(function(err, list){
    if (err || !list)
      return callback(err || new Error('No access points detected.'));

    var open_aps = list.filter(function(ap) {
      return ap.security === false;
    });

    if (open_aps.length === 0)
      return callback(null, []);

    callback(null, open_aps);
  });

};

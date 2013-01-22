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

var
  needle   = require('needle'),
  async    = require('async'),
  common   = require('./../../common'),
  hardware = require('./../hardware'),
  os_functions = require('./' + common.os_name),
  exp = module.exports;

/////////////////////////////////////////////////////////////////
// helper
/////////////////////////////////////////////////////////////////

exp.mac_address_regex = hardware.mac_address_regex;
exp.ip_address_regex = /^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})$/;

exp.is_mac_address = function(str){
	return exports.mac_address_regex.test(str);
}

exp.is_ip_address = function(str){
  return exports.ip_address_regex.test(str);
};

/////////////////////////////////////////////////////////////////
// network interface functions
/////////////////////////////////////////////////////////////////

/**
 * @param {String} platform specific name, e.g. eth0, Local Area Connection
 **/
exp.nic_by_name = async.memoize(function(name, callback) {

  hardware.get_network_interfaces_list(function(err, list){
    if (err) return callback(err);

    var nics = list.filter(function(nic) { return nic.name === name; });

    if (nics.length > 0)
      callback(null, nics[0]);
    else
      callback(new Error('No network interface named ' + name));
  });

});

/////////////////////////////////////////////////////////////////
// getters
/////////////////////////////////////////////////////////////////

/**
 * Makes an Http connection to checkip.dyndns.org to find current public IP.
 **/
exp.get_public_ip = function(callback){

  var regex = /Current IP Address: (\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/,
      url = 'checkip.dyndns.org';

  needle.get(url, function(err, resp, body){
    if (!err)
      var ip = body && body.match(regex)[1];

    callback(err, ip); // should return one or the other
  })

};

/**
 * Callsback the private IP of the active network interface.
 * If no active NIC is found, return the first valid private IP assigned.
 **/
exp.get_private_ip = function(callback) {

  hardware.get_network_interfaces_list(function(err, list){
    if (err || !list)
      return callback(err || new Error('No network interfaces found.'));

    os_functions.get_active_network_interface_name(function(err, active_nic) {
      // if (err) return cb(err);

      var ips = list.filter(function(nic) {
        if (exports.is_ip_address(nic.ip_address))
          return active_nic ? active_nic == nic.name : true;
      });

      if (ips.length > 0)
        callback(null, ips[0].ip_address);
      else
        callback(new Error('No private IPs found (' + list.length + ' interfaces)'));
    });
  });

};

exp.get_gateway_ip = function(cb){

  os_functions.get_active_network_interface_name(function(err, nic_name) {
    if (err) return cb(err);

    os_functions.gateway_ip_for(nic_name, function(err, out){
      if (err || !out || out.toString() == '')
        return cb(err || new Error('No gateway IP assigned to ' + nic_name));

      cb(null, out.toString().trim())
    })

  });

};

/**
 * Callsback a nic object with broadcast address.
 **/
exp.get_active_network_interface = function(callback){

  os_functions.get_active_network_interface_name(function(err, nic_name) {
    if (err) return callback(err);

    exp.nic_by_name(nic_name, function(err, nic){
      if (err) return callback(err);

      os_functions.netmask_for(nic_name, function(err, netmask){
        if (!err && netmask)
          nic.netmask = netmask.trim();

        callback(null, nic);
      });
    });

  });

};

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

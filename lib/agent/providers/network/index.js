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

/**
 * callsback null, true on wifi, null, false on no wifi
 **/
exp.have_wifi = os_functions.have_wifi;

/////////////////////////////////////////////////////////////////
// functions (not available as getters)
/////////////////////////////////////////////////////////////////

exp.broadcast_address_for = os_functions.broadcast_address_for;

/**
 * @param {String} platform specific name, e.g. eth0, Local Area Connection
 **/
exp.nic_by_name = async.memoize(function(name, callback) {

  hardware.get_network_interfaces_list(function(err, list){
    if(err) return callback(err);

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
      var ip = body.match(regex)[1];

    callback(err, ip); // should return one or the other
  })

};

/**
 * Callsback an internal IP address.
 * Gets list of networks interfaces and returns the first that has an assigned IP.
 **/
exp.get_private_ip = function(callback) {

  hardware.get_network_interfaces_list(function(err, list){
    if (err || !list)
      return callback(err || new Error('No network interfaces found.'));

    var ips = list.filter(function(nic) {
      return exports.is_ip_address(nic.ip_address);
    });

    if (ips.length > 0)
      callback(null, ips[0].ip_address);
    else
      callback(new Error('No private IPs found (' + list.length + ' interfaces)'));
  });

};


/**
 * Callsback a nic object with broadcast address.
 **/
exp.get_active_network_interface = function(callback){

  os_functions.get_active_network_interface_name(function(err, nic_name) {

    exp.nic_by_name(nic_name, function(err, nic){
      if (err) return callback(err);

      exp.broadcast_address_for(nic_name, function(err, bc_address){
        if (err) return callback(err);

        nic.broadcast_address = bc_address;
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
exp.get_wireless_interface_names = os_functions.get_wireless_interface_names;


/**
 * Callsback at least one wireless interface name.
 **/
exp.get_first_wireless_interface = function(callback){

  exp.get_wireless_interface_names(function(err, list) {
    if (err || !list)
      return callback(err || new Error('No Wifi interfaces found.'));

    callback(null, list[0]);
  });
};

/**
 *
 **/
exp.get_access_points_list = function(callback){

  exp.get_first_wireless_interface(function(err, nic_name){
    if (err || !nic_name)
      return callback(new Error(err || 'No wireless adapter found.'));

    os_functions.access_points_list(nic_name, callback);
  });

};

/**
 * Callsback an AP object of the one that the device is connected to.
 **/
exp.get_active_access_point = function(callback){

  os_functions.get_active_access_point(function(err, ap) {

    if (err || !ap)
      return callback(err || new Error('No active access point found.'));

    exp.get_access_points_list(function(err, aps) {
      if (err) return callback(err);

      var padded_mac = ap.toString().trim().replace(/(^|:)(?=[0-9a-fA-F](?::|$))/g, "$10");
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


/**
 * Callback an array of open access points, sorted by signal strength.
 * If none exist, return the empty array.
 **/
exp.get_open_access_points_list = function(callback){

  exp.get_access_points_list(function(err, list){
    if (err || !list)
      return callback(new Error(err || 'No access points detected.'));

    var open_aps = list.filter(function(ap) {
      return ap.security === false;
    });

    if (open_aps.length === 0)
      return callback(null, []);

    // sort them from the nearest to the farthest
    open_aps.sort(function(a, b){
      return a.signal_strength > b.signal_strength;
    });

    callback(null, open_aps);
  });

};

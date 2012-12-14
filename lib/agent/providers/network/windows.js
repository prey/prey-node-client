"use strict";

//////////////////////////////////////////
// Prey JS Network Module Windows Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var system = require('./../../common').system,
    wmic   = system.wmic,
    exec   = require('child_process').exec;

/**
  Callsback a nic name.
 **/
exports.get_active_network_interface_name = function(callback) {
  var query = 'path Win32_NetworkAdapter' +
              ' where "NetConnectionStatus = 2"' +
              ' get NetConnectionID';

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
 * TODO
 **/
exports.get_active_access_point = function(callback) {
  callback(new Error('TODO!'));
};


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

    var cmd = (ver === "XP" || ver === "2000") ? "autowcxp" : "autowc";

    exec(cmd, function(err, output) {
      if (err) return callback(err);

    // output from autowc doesn't seem to have array brackets
    // so add and convert to js array of objects
    var list = exports.parse_access_points_list('[' + output + ']');

		if (list.length > 0)
		  callback(null, list)
		else
  		callback(new Error("No access points found."));

    });
  });
};

exports.parse_access_points_list = function(out, cb){

  var arr = [];
  try { arr = JSON.parse(out) }
  catch(e) { return arr; };

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

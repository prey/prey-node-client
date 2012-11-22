
"use strict";

//////////////////////////////////////////
// Prey JS Network Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////


/**
 * Memoize nic functions but not access point stuff as that can change - probably best
 * to always do a scan with these.
 **/

var
  needle   = require('needle'),
  common   = require('./../../common'),
  helpers  = common.helpers,
  hardware = require('./../hardware'),
  os_functions = require('./' + common.os_name),
  exp = module.exports;

/**
 * Checks for a valid ip_address format.
 **/
exports.is_ip_address = function(str){
  var regex = /^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})$/;
  return regex.test(str);
};

exports.mac_address_regex = /([0-9a-f]{2}[:-]){5}([0-9a-f]{2})/i;

exports.is_mac_address = function(str){
	return exports.mac_address_regex.test(str);
}

/**
 * Makes an Http connection to checkip.dyndns.org to find current public IP.
 **/
exp.get_public_ip = helpers.report(helpers.memoize(function(callback){

  var regex = /Current IP Address: (\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/,
      url = 'checkip.dyndns.org';

  needle.get(url, function(err, resp, body){
    if (!err)
      var ip = body.match(regex)[1];

    callback(err, ip); // should return one or the other
  })

},function() { return "key"; }));

/**
 * Callsback an internal IP address.
 **/
exp.get_private_ip = helpers.report(helpers.memoize(function(callback) {

  hardware.get_network_interfaces_list(function(err, list){
    if (err || !list)
      return callback(_error(err || 'No network interfaces found.'));

    var ips = list.filter(function(nic) {
      return exports.is_ip_address(nic.ip_address);
    });

    if (ips.length > 0)
      callback(null, ips[0].ip_address);
    else
      callback(_error('No private IPs found (' + list.length + ' interfaces)'));
  });

},function() { return "key"; }));

/**
 * Delegate entirely to os_functions
 * @param {String} platform specific name, e.g. eth0, Local Area Connection
 **/
exp.get_broadcast_address = function(nic_name, callback){
  hardware.get_broadcast_address(nic_name,callback);
};

/**
 * @param {String} platform specific name, e.g. eth0, Local Area Connection
 **/
exp.get_nic_by_name = helpers.memoize(function(name, callback) {
  hardware.get_network_interfaces_list(function(err, list){
    if(err) return callback(_error(err));

    var nics = list.filter(function(nic) { return nic.name === name; });
    if (nics.length > 0)
      callback(null,nics[0]);
    else
      callback(_error('No named nic',name));
  });
});

/**
 * Callsback a nic object with broadcast address.
 **/
exp.get_active_network_interface = helpers.report(helpers.memoize(function(callback){
  os_functions.active_network_interface_name(function(err, nic_name) {
    exp.get_nic_by_name(nic_name, function(err, nic){
      if(err) return callback(_error(err));

      hardware.get_broadcast_address(nic_name, function(err, bc_address){
        if (err) return callback(_error(err));
        if(!err) nic.broadcast_address = bc_address;
        callback(null, nic);
      });
    });
  });
},function() { return "key"; }));

/**
 * callsback null,true on wifi, null,false on no wifi
 **/
exp.have_wifi = os_functions.have_wifi;

/**
 * Callsback an array of wireless interface names
 **/
exp.get_wireless_interface_names = function(callback){
  os_functions.wireless_interface_names(callback);
};

/**
 * Callsback at least one wireless interface name.
 **/
exp.get_first_wireless_interface = helpers.report(function(callback){
  exp.get_wireless_interface_names(function(err, list) {
    if (err || !list)
      return callback(_error(err || 'No Wifi interfaces found.'));

    callback(null, list[0]);
  });
});


/**
 *
 **/
exp.get_access_points_list = helpers.report(helpers.memoize(function(callback){
  exp.get_first_wireless_interface(function(err, nic_name){
    if (err || !nic_name)
      return callback(_error(err || 'No wireless adapter found.'));

    os_functions.get_access_points_list(nic_name, callback);
  });
}));

/**
 * Callsback a MAC address of a wireless AP.
 **/
exp.get_active_access_point = helpers.report(function(callback){
  os_functions.active_access_point(function(err,ap) {
    if (err || !ap)
      return callback(_error(err || 'No active access point found'));

    exp.get_access_points_list(function(err,accessPoints) {
      if (err) return callback(_error(err));

      var padded_mac = ap.toString().trim().replace(/(^|:)(?=[0-9a-fA-F](?::|$))/g, "$10");
      var aps = accessPoints.filter(function(ap) { return ap.mac_address === padded_mac; });

      if (aps.length > 0) {
        callback(null, aps[0]);
      } else {
        callback(_error('Could not find matching access point.', padded_mac));
      }

    });
  });
});


/**
 * Callback an array of open access points, sorted by signal strength.
 * If none exist, return the empty array.
 **/
exp.get_open_access_points_list = helpers.report(function(callback){

  exp.get_access_points_list(function(err, list){
    if (err || !list)
      return callback(_error(err || 'No access points detected.'));

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

});


"use strict";

//////////////////////////////////////////
// Prey JS Network Module Windows Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var
  wmic = _ns('windows').wmic,
  system = _ns('system'),
  exec = require('child_process').exec;
     
/**
  Callsback a nic name.
 **/
exports.active_network_interface_name = function(callback) {
  var query = 'path Win32_NetworkAdapter' + 
              ' where "NetConnectionStatus = 2"' +
              ' get NetConnectionID';
  
  wmic.run(query,function(err,out) {
    if (err) return callback(_error("!:"+query,err));

    callback(null,out.split("\n")[1].trim());
  });
};

/**
 * Callsback a list of wireless adapter names.
 **/
exports.wireless_interface_names = function(callback) {
  var query = 'path Win32_NetworkAdapter where "Name like \'%Wireless%\'" get NetConnectionID';
  wmic.run(query,function(err,o) {
    if (err) return callback(_error("!:"+query,err));

    callback(null, o.split("\n").splice(1).map(function(n) { return n.trim(); }));
  });
};

/**
 * Gets access points list 
 * @param {String} wifi_device - should return something like
 * { ssid:"",security:true,quality:23,signal_strength:54,noise_level:24}
 *
 * autowc actually returns {mac_address,ssid,signal_strength,channel,signal_to_noise} this function converts
 **/
exports.access_points_list = function(wifi_device, callback) {
	if(!wifi_device || wifi_device === '') return callback(_error('No wifi device'));

  system.get_os_version(function(err,ver) {
    var cmd = (ver === "XP" || ver === "2000") ? "autowcxp" : "autowc";
    exec(cmd,function(err,output) {
      if (err) return callback(_error(err));
      
      // output from autowc doesn't seem to have array brackets, so add and convert to js array of objects
      callback(null,JSON.parse('['+output+']').map(function(o) {
        // return what this system expects as input
        return {
          ssid:o.ssid,
          security:null, // don't have this data
          quality:null,
          signal_strength:o.signal_strength,
          noise_level:o.signal_to_noise
        };
      }));
    });
  });
};

/**
 * TODO
 **/
exports.active_access_point = function(callback) {
  callback(null,"");
};


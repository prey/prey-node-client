
"use strict";

//////////////////////////////////////////
// Prey JS Network Module Windows Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var wmic = _ns('wmic');
     
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
  wmic.run(query,function(e,o) {
    if (e) return callback(_error("!:"+query,err));

    callback(null, o.split("\n").splice(1).map(function(n) { return n.trim(); }));
  });
};

/**
 * TODO
 * Gets access points list 
 * @param {String} wifi_device - should return something like
 * { ssid:"",security:true,quality:23,signal_strength:54,noise_level:24}
 **/
exports.access_points_list = function(wifi_device, callback) {
	if(!wifi_device || wifi_device === '') return callback(_error('No wifi device'));
		callback(null,[]);
};

/**
 * TODO
 **/
exports.active_access_point = function(callback) {
  callback(null,"");
};


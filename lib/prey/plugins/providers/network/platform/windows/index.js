
"use strict";

//////////////////////////////////////////
// Prey JS Network Module Windows Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var
exec = require('child_process').exec;
     
/**
 **/
exports.active_network_interface = function(callback) {
  Prey.hardware.get_active_nic_names(callback);
};

/**
 * TODO
 * Gets access points list 
 * @param {String} wifi_device 
 **/
exports.access_points_list = function(wifi_device, callback) {
	if(!wifi_device || wifi_device === '') return callback(null);

		callback(null,[]);
	});
};

/**
 * TODO
 **/
exports.wireless_interface_names = function(callback) {
      callback(null, []);
  });
};

/**
 * TODO
 **/
exports.active_access_point = function(callback) {
  callback(null,"");
  });
};
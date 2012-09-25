
"use strict";

//////////////////////////////////////////
// Prey JS Network Module Windows Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var
exec = require('child_process').exec;
     
var parse_access_points_list = function(output){
  return output
        .split(/Cell \d\d - /)
        .splice(1)
        .map(function(block) {
          return block.split(/\n/)
                .filter(function(line) { return line.trim().length > 0 ; })
                .reduce(function(o,line) {
                  var m = line.match(/^\s*(.+?):(.*)$/);
                  switch(m[1]) {
                  case "ESSID":
                    o.ssid = m[2].slice(1,-1); // remove ""
                    break;
                  case "Address":
                    o.mac_address = m[2].trim();
                    break;
                  case "Encryption key":
                    o.security = (m[2].trim() === "on") ? true : false;
                    break;
                  case "Quality":
                    o.quality = m[2].substr(0,3);
                    var signal = m[2].match(/Signal level.([0-9\/\-]*) ?dBm([^"{]*)/);
                    o.signal_strength = signal[1];
                    var noise = m[2].match(/Noise level.([0-9\/\-]*) ?dBm([^"{]*)/);
                    o.noise_level = noise[1];
                    break;
                  }
                return o;
                },{security:false});
        });
};

/**
 **/
exports.active_network_interface = function(callback) {
  Prey.hardware.get_active_nic_names(callback);
};

/**
 * Gets access points list using iwlist (requires wireless-tools package).
 * @param {String} wifi_device 
 **/
exports.access_points_list = function(wifi_device, callback) {
	if(!wifi_device || wifi_device === '') return callback(null);

  var ap_cmd =
        'iwlist ' + wifi_device +
        ' scan | grep -v "Frequency" | egrep "Address|Channel|ESSID|Signal|Encryption"';

  exec(ap_cmd, function(err, stdout){
		var output = stdout.toString().trim();
		if(err || output === '') return callback(false);
		callback(null,parse_access_points_list(output));
	});
};

/**
 * 
 **/
exports.wireless_interface_names = function(callback) {
  var cmd = "iwconfig 2>&1 | grep -v 'no wireless' | cut -f1 -d' ' | sed '/^$/d'";
  exec(cmd, function(err, stdout){
      if(err) return callback(err);
      var list = stdout.toString().trim().split('\n');
      callback(null, list);
  });
};

/**
 * 
 **/
exports.active_access_point = function(callback) {
  var cmd = "iwconfig 2>&1 | grep 'Access Point' | awk '{print $6}'";
  exec(cmd, function(err, stdout){      
    if(err) return callback(err);
    
    var raw = stdout.toString().trim();
    if( raw === '' || raw === "Not-Associated")
      return callback(new Error("No active access point found."));

    callback(null,raw);
  });
};
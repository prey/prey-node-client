//////////////////////////////////////////
// Prey JS Network Provider Mac Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak, Diego Torres - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
		exec = require('child_process').exec;

// exports.mac_addresses_list_cmd = "networksetup -listallhardwareports | grep Address | awk '{print $NF}'";
exports.wireless_devices_list_cmd = "networksetup -listallhardwareports | grep Wi-Fi -A1 | grep Device | awk '{print $NF}'";
exports.active_access_point_cmd = "airport -I | grep ' SSID:' | awk '{print $2}'";

exports.broadcast_address_cmd = function(nic){
	return "ifconfig | grep " + nic + " -A1 | awk '/broadcast/ {print $NF}'";
};

exports.get_access_points_list = function(wifi_device, callback) {

	// if(!wifi_device || wifi_device == '') return callback(false);
	
	var cmd = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -s';
	
	exec(cmd, function(err, stdout, stderr){
	
		if(err) return callback(err);
		if(stdout.toString() == 'No networks found') return callback(new Error("No networks found."));
				
		var lines = stdout.toString().trim().split("\n");
		var list = [];

		lines.forEach(function(line, i){
			
			var properties = line.trim().match(/([A-Za-z0-9\-]+) +(([0-9a-z]{2}:?){6}) +(-[0-9]{2}) +([0-9a-zA-Z,\+]+) +(Y|N) +([A-Z\-]{2}) +(.*)/);
            if (properties) {
                var ap = {
					ssid: properties[1],
					mac_address: properties[2],
					signal_strength: properties[4], //3 is Mac last hex
					channel: properties[5],
					security: properties[8] //7 is country
				};
				list.push(ap);
            }
			
		});

		// console.log(list);
		return (list.length > 0) ? callback(null, list) : callback(new Error("No access points found."));
		
	});

};

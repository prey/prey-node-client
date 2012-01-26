//////////////////////////////////////////
// Prey JS Network Provider Mac Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec = require('child_process').exec;
var fs = require('fs');

// exports.mac_addresses_list_cmd = "networksetup -listallhardwareports | grep Address | awk '{print $NF}'";
exports.wireless_devices_list_cmd = "networksetup -listallhardwareports | grep Wi-Fi -A1 | grep Device | awk '{print $NF}'";
exports.active_access_point_cmd = "airport -I | grep ' SSID:' | awk '{print $NF}'";

exports.broadcast_address_cmd = function(nic){
	return "ifconfig | grep " + nic + " -A1 | awk '/broadcast/ {print $NF}'";
};

exports.get_access_points_list = function(wifi_device, callback) {

	// if(!wifi_device || wifi_device == '') return callback(false);
	
	var cmd = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -s';
	
	exec(cmd, function(err, stdout, stderr){
				
		var lines = stdout.toString().trim().split("\n");
		var list = [];

		lines.forEach(function(line, i){
			
			if(i == 0) return;
			var data = line.split(/\s+/);
			
			var ap = {
				ssid: data[1],
				mac_address: data[2],
				signal_strength: data[3],
				channel: data[4],
				security: data[7]
			};
			
			if(ap.ssid) list.push(ap);
			
		});

		return (list.length > 0) ? callback(list) : callback(null);
		
	});

}

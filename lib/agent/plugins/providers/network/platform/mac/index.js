//////////////////////////////////////////
// Prey Network Provider Mac Functions
// Written by Tomas Pollak
// (c) 2012 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
		exec = require('child_process').exec,
		mac_address_regex = require('./../../').mac_address_regex;

var airport = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport';

// exports.mac_addresses_list_cmd = "networksetup -listallhardwareports | grep Address | awk '{print $NF}'";
exports.wireless_devices_list_cmd = "networksetup -listallhardwareports | grep Wi-Fi -A1 | grep Device | awk '{print $NF}'";
exports.active_access_point_mac_cmd = airport + " -I | grep ' BSSID:' | awk '{print $2}'";

exports.broadcast_address_cmd = function(nic){
	return "ifconfig | grep " + nic + " -A1 | awk '/broadcast/ {print $NF}'";
};

exports.get_access_points_list = function(wifi_device, callback) {

	// if (!wifi_device || wifi_device == '') return callback(false);
	var cmd = airport + ' -s';

	exec(cmd, function(err, stdout, stderr){

		if (err) return callback(err);
		if (stdout.toString() == 'No networks found')
		  return callback(new Error("No networks found."))

    var list = exports.parse_access_points_list(stdout);
		return (list.length > 0) ? callback(null, list) : callback(new Error("No access points found."));

	});

}

exports.parse_access_points_list = function(stdout){
	var list = [],
	    lines = stdout.toString().trim().split("\n");

	lines.forEach(function(line, i){

		if (i == 0 || line == '') return;
		var start = line.split(/\s[0-9a-f]{2}[:|-]/); // split on MAC addr start
		if (!start[1]) return;
		var end = start[1].split(/\s[A-Z-]{2}\s/); // split on CC, before security
		var data = end[0].split(/\s+/); // rest of data doesn't contain spaces so we're good

		var ap = {
			ssid: start[0].trim(),
			mac_address: line.match(mac_address_regex)[0],
			signal_strength: data[1],
			channel: data[2],
			security: end[1].trim()
		};

		if (ap.ssid && ap.mac_address)
		  list.push(ap);

	});

	return list;
}

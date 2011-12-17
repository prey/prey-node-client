//////////////////////////////////////////
// Prey JS Network Provider Mac Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec = require('child_process').exec;
var fs = require('fs');

exports.mac_addresses_list_cmd = "ifconfig | grep 'HWaddr' | awk '{print $5}'";
exports.wireless_devices_list_cmd = "iwconfig 2>&1 | grep -v 'no wireless' | cut -f1 -d' ' | sed '/^$/d'";
exports.active_access_point_cmd = "iwconfig status 2>&1 | grep 'Access Point' | awk '{print $6}'";

exports.mac_address_cmd = function(nic){
	return "ifconfig | grep " + nic + " | grep 'HWaddr' | awk '{print $5}'";
};

exports.broadcast_address_cmd = function(nic){
	return "ifconfig | grep " + nic + " -A1 | awk '/Bcast/ {print $3}'";
};

exports.get_access_points_list = function(wifi_device, callback) {

	if(!wifi_device || wifi_device == '') return callback(false);

	// gets access points list using iwlist (requires wireless-tools package)
	var access_points_list_cmd = 'iwlist ' + wifi_device + ' scan | grep -v "Frequency" | egrep "Address|Channel|ESSID|Signal"';

	exec(access_points_list_cmd, function(err, stdout, stderr){

		// var output = fs.readFileSync('test/iwlist_grepped.txt').toString();
		var output = stdout.toString().trim();

		if(err || output == '') return callback(false);

		var parsed = exports.parse_access_points_list(output);

		var list = "[" + parsed + "]";
		callback(list);

	});

}

exports.parse_access_points_list = function(output){

	var parsed =
		output.replace(/\n/g, '')
		.replace(/  /g, '')
		.replace(/Cell[0-9 -]+/g, '')
		.replace(/Quality[0-9=:\/ ]*Signal/g, '')
		.replace(/([A-F0-9]):([A-F0-9])/g, '$1-$2')
		.replace(/Channel:([0-9]+)/g, '"channel": $1,')
		.replace(/Address: ?([A-F0-9-]{17})/g, '{"mac_address": "$1", ')
		.replace(/ESSID:"?([^"]*)"?/g, '"ssid": "$1",')
		.replace(/level.([0-9\/-]*) ?dBm([^"{]*)/g, '"signal_strength": $1, ')
		.replace(/, ?{/g, "}, {")
		.replace(/\\\x../g, '')
		.replace(/, ?$/, '}');

	return parsed;

}

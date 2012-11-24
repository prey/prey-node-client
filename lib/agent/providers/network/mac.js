//////////////////////////////////////////
// Prey Network Provider Mac Functions
// Written by Tomas Pollak
// (c) 2012 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
		exec = require('child_process').exec,
		mac_address_regex = require('./index').mac_address_regex,
		airport_cmd = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport';

exports.get_active_network_interface_name = function(callback) {
  callback(new Error('TODO!'))
};


/**
 * Returns a list of wireless interface names (wlan0, wlan1, etc). It may be empty.
 **/
exports.get_wireless_interface_names = function(callback) {
  var cmd = "networksetup -listallhardwareports | grep Wi-Fi -A1 | grep Device | awk '{print $NF}'";
  exec(cmd, callback);
};

/**
 * Return the name of the active access point.
 **/
exports.get_active_access_point = function(callback) {
  var cmd = airport_cmd + " -I | grep ' BSSID:' | awk '{print $2}'";
  exec(cmd, callback);
};

exports.broadcast_address_for = function(nic_name, callback){
  var cmd = "ifconfig | grep " + nic_name + " -A1 | awk '/broadcast/ {print $NF}'";
  exec(cmd, callback);
};

/////////////////////////////////////////////////////////////////
// access points list fetcher and parser
/////////////////////////////////////////////////////////////////

exports.access_points_list = function(wifi_device, callback) {
	if (!wifi_device || wifi_device == '')
	  return callback(new Error('Wifi device required'));

	var cmd = airport_cmd + ' -s';

	exec(cmd, function(err, stdout, stderr){
		if (err) return callback(err);

		if (stdout.toString().match(/No networks/i))
		  return callback(new Error("No networks found."))

    var list = exports.parse_access_points_list(stdout);

		if (list.length > 0)
		  callback(null, list)
		else
  		callback(new Error("No access points found."));

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

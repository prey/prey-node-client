//////////////////////////////////////////
// Prey Network Provider Mac Functions
// Written by Tomas Pollak
// (c) 2012 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec        = require('child_process').exec,
    airport_cmd = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport';

var mac_address_regex = /([0-9a-f]{2}[:-]){5}([0-9a-f]{2})/i;

var attemps = 100,
    current_attemp;

var try_getting_ap_list = function(out, cb) {
  current_attemp++;
  if (current_attemp >= attemps) return cb(null, out);
  else if (out && out != '')     return cb(null, out);
  else {
    exec(airport_cmd + ' -s', function(err, stdout) {
      try_getting_ap_list(stdout, cb);
    });
  }
};

/**
 * Returns a list of wireless interface names (wlan0, wlan1, etc). It may be empty.
 **/
exports.get_wireless_interfaces_list = function(cb) {
  var cmd = "networksetup -listallhardwareports | grep Wi-Fi -A1 | grep Device | awk '{print $NF}'";
  exec(cmd, function(err, out){
    if (err) return cb(err);
    cb(null, out.toString().trim().split('\n'));
  });
};

exports.get_active_access_point_mac = function(callback) {
  var cmd = airport_cmd + " -I | grep 'BSSID:' | awk '{print $2}'";
  exec(cmd, callback);
};

/////////////////////////////////////////////////////////////////
// access points list fetcher and parser
/////////////////////////////////////////////////////////////////

exports.get_access_points_list = function(callback) {
  current_attemp = 0;

  try_getting_ap_list(null, function(err, stdout) {
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

exports.parse_access_points_list = function(stdout) {

  var list = [],
      lines = stdout.toString().trim().split("\n");

  lines.forEach(function(line, i) {

    if (i == 0 || line == '') return;
    var start = line.split(/\s[0-9a-f]{2}[:|-]/); // split on MAC addr start
    if (!start[1]) return;

    var end  = start[1].split(/\s[A-Z-]{2}\s/); // split on CC, before security
    var data = end[0].split(/\s+/); // rest of data doesn't contain spaces so we're good
    var sec  = end[1] && end[1].trim();

    var ap = {
      ssid            : start[0].trim().replace(/[^\w :'-]/g, ''), // remove weird chars
      mac_address     : line.match(mac_address_regex)[0],
      signal_strength : parseInt(data[1]), // use positive integers
      channel         : parseInt(data[2]),
      security        : (sec == 'NONE') ? false : sec
    };

    if (ap.ssid && ap.mac_address)
      list.push(ap);

  });

  return list;
}

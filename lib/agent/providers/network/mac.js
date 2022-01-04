//////////////////////////////////////////
// Prey Network Provider Mac Functions
// Written by Tomas Pollak
// (c) 2012 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs          = require('fs'),
    sudo        = require('sudoer'),
    exec        = require('child_process').exec,
    common      = require('../../common'),
    airport_cmd = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport';

var mac_address_regex = /([0-9a-f]{2}[:-]){5}([0-9a-f]{2})/i;

var attemps = 100,
    current_attemp;

var access_points_function = function(cmd, args, cb) {
  if (common.os_release >= "12.0") {
    sudo(cmd, args, function(err, stdout, stderr) {
      return cb(err, stdout);
    });
  } else {
    exec(cmd + " " + args.join(' '), function(err, stdout) {
      return cb(err, stdout);
    });
  }
}

var get_ap_list_retry = function(out, cb) {
  current_attemp++;
  if (current_attemp >= attemps) return cb(null, out);
  else if (out && out != '')     return cb(null, out);
  else {
    access_points_function(airport_cmd, ["-s"], (err, stdout) => {
      if (err && err.message.includes("No sudo access")) return cb(err);
      get_ap_list_retry(stdout, cb);
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
  var output;
  access_points_function(airport_cmd, ["-I"], (err, stdout) => {
    if (err) return callback(err);

    stdout = stdout.toString().split("\n");
    stdout.forEach(function(line, index) {
      var data = line.split(": ");
      if (data[0].trim() == "BSSID") {
        output = data[1]; 
      }

      if (index == stdout.length - 1) {
        return callback(null, output);
      }
    })
  });
};

exports.get_active_access_point = function(callback) {
  var process_active_ap = function(stdout) {
    if (stdout.includes('AirPort: Off') || !stdout.includes('SSID'))
      return callback(new Error('Wifi connection unavailable'));

    var out = stdout.split('\n').slice(0, -1);

    var result = {};
    out.forEach((obj) => {
      var values = obj.split(': ');
      result[values[0].trim()] = values[1].trim()
    });

    var ssid            = escape(result.SSID),
        mac_address     = result.BSSID,
        signal_strength = parseInt(result.agrCtlRSSI),
        channel         = parseInt(result.channel),
        security        = result['link auth'];

    var ap = {ssid: ssid, mac_address: mac_address, signal_strength: signal_strength, channel: channel, security: security}
    callback(null, ap);
  }

  access_points_function(airport_cmd, ["-I"], (err, stdout) => {
    if (err) return callback(err);
    process_active_ap(stdout);
  })
}

/////////////////////////////////////////////////////////////////
// access points list fetcher and parser
/////////////////////////////////////////////////////////////////

exports.get_access_points_list = function(callback) {

  var process_ap_list = function(stdout) {
    if (stdout.toString().match(/No networks/i))
      return callback(new Error("No networks found."))

    var list = exports.parse_access_points_list(stdout);

    if (list.length > 0)
      callback(null, list)
    else
      callback(new Error("No access points found."));
  }

  current_attemp = 0;
  get_ap_list_retry(null, function(err, stdout) {
    if (err) return callback(err);
    process_ap_list(stdout)
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

exports.get_active_interface = function(cb) {
  var cmd = "netstat -rn | grep UG | awk '{print $4}'";
  exec(cmd, function(err, stdout) {
    if (err) return cb(err);

    var raw = stdout.toString().trim().split('\n');
    if (raw.length === 0 || raw === [''])
      return cb(new Error('No active network interface found.'));

    cb(null, raw[0]);
  });
};

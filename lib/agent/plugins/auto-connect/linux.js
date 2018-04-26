var join         = require('path').join,
    exec         = require('child_process').exec;
    network = require('./../../agent/providers/network/linux');

var net_interface = null;

var get_interface = function(cb) {
  network.get_first_wireless_interface(function(err, data) {
    net_interface = data;
  });
}

exports.get_existing_profiles = function(cb) {
  get_interface(function(err, net_interface) {
    var cmd = 'ls /etc/NetworkManager/system-connections'
    exec(cmd, function(err, stdout) {
      cb(null, stdout.split("\n").slice(0, -1));
    })
  })
}

exports.create_profile = function(ssid, cb) {
  var cmd = 'nmcli connection add type wifi ifname ' + '"' +  net_interface + '"' + ' con-name '  + '"' +  ssid  + '"' +  ' ssid '  + '"' +  ssid + '"';
  exec(cmd, function(err, out) {
    return cb && cb(err);
  })
}

exports.delete_profile = function(ssid, cb) {
  exec('nmcli connection delete ' + '"' + ssid + '"', function(err, out) {
    return cb && cb(err);
  })
}

exports.connect_to_ap = function(ssid, cb) {  // revisar cb si va
  var cmd = 'nmcli connection up ' + '"' + ap.ssid + '"';
  exec(cmd, function(err, out) {
    return cb(null)
  });
}

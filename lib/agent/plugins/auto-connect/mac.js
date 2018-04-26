var join         = require('path').join,
    exec         = require('child_process').exec,
    system       = require('./../../../system'),
    run_as_user  = system.run_as_logged_user;

var net_interface = null;

var get_interface = function(cb) {
  var cmd = 'networksetup -listallhardwareports | awk "/Hardware Port: Wi-Fi/,/Ethernet/" | awk "NR==2" | cut -d " " -f 2';
  exec(cmd, function(err, data) {
    if (err) return cb(err);

    net_interface = data.split("\n").slice(0, -1);
    return cb(null, net_interface);
  })
}

exports.get_existing_profiles = function(cb) {
  get_interface(function(err, net_interface) {
    var cmd = "networksetup -listpreferredwirelessnetworks en0 | awk '{print $1}' |awk 'NR>1'"
    exec(cmd, function(err, stdout) {
      cb(null, stdout.split("\n").slice(0, -1));
    })
  })
}

exports.create_profile = function(cb) {
  var cmd = 'networksetup -addpreferredwirelessnetworkatindex ' + net_interface + ' ' + ssid +  ' 0 open';
  run_as_user(cmd, [], function(err) {
    return cb && cb(err);
  })
}

exports.delete_profile = function(cb) {
  var cmd = ['networksetup', '-removepreferredwirelessnetwork', net_interface, '"' + ssid + '"'].join(' ');
  run_as_user(cmd, [], function(err) {
    return cb && cb(err);
  })
}

exports.connect_to_ap = function(ssid, cb) {  // revisar cb si va
  var cmd = ['networksetup', '-setairportnetwork', net_interface, ssid].join(' ');
  run_as_user(cmd, [], function() {
    return cb(null);
  });
}

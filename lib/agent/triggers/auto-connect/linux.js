var exec = require('child_process').exec,
  network = require('./../../providers/network/linux');

var net_interface = null;

var get_interface = function (_cb) {
  network.get_first_wireless_interface(function (err, data) {
    net_interface = data;
  });
};

exports.enable_wifi = function (cb) {
  var turn_on_wifi = function () {
    var cmd = 'nmcli networking on; nmcli radio wifi on';
    exec(cmd, function (err) {
      if (err) cb(new Error(err));

      return cb();
    });
  };
  net_interface ? turn_on_wifi() : get_interface(turn_on_wifi);
};

exports.get_existing_profiles = function (cb) {
  var get_profiles = function () {
    var cmd = 'ls /etc/NetworkManager/system-connections';
    exec(cmd, function (err, stdout) {
      cb(null, stdout.split('\n').slice(0, -1));
    });
  };
  net_interface ? get_profiles() : get_interface(get_profiles);
};

exports.create_profile = function (ssid, cb) {
  var create = function () {
    var cmd = `nmcli connection add type wifi ifname ${net_interface} con-name "${ssid}" ssid "${ssid}"`;
    exec(cmd, function (err) {
      return cb && cb(err);
    });
  };
  net_interface ? create() : get_interface(create);
};

exports.delete_profile = function (ssid, cb) {
  var discard = function () {
    // var cmd = `nmcli connection delete "${ssid}"`;
    exec('nmcli connection delete ' + '"' + ssid + '"', function (err, out) {
      return cb && cb(err);
    });
  };
  net_interface ? discard() : get_interface(discard);
};

exports.connect_to_ap = function (ssid, cb) {
  var connect = function () {
    var cmd = `nmcli connection up "${ssid}"`;
    exec(cmd, function (err, out) {
      return cb(err, out);
    });
  };
  net_interface ? connect() : get_interface(connect);
};

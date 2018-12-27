var exec    = require('child_process').exec;
    network = require('./../../providers/network/linux');

var net_interface = null,
    interface_err = 'Unable to get wifi interface';

var get_interface = (cb) => {
  network.get_first_wireless_interface((err, data) => {
    if (err) return cb(err);

    net_interface = data;
    return cb(null);
  });
}

exports.enable_wifi = (cb) => {
  var turn_on_wifi = (err) => {
    if (err || !net_interface) return cb(new Error(interface_err));

    var cmd = 'nmcli networking off; nmcli networking on; nmcli radio wifi on';
    exec(cmd, (err, data) => {
      return cb();
    })
  }
  net_interface ? turn_on_wifi() : get_interface(turn_on_wifi);
}

exports.get_existing_profiles = (cb) => {
  var get_profiles = (err) => {
    if (err || !net_interface) return cb(new Error(interface_err));

    var cmd = 'ls /etc/NetworkManager/system-connections'
    exec(cmd, (err, stdout) => {
      cb(null, stdout.split("\n").slice(0, -1));
    })
  }
  net_interface ? get_profiles() : get_interface(get_profiles);
}

exports.create_profile = (ssid, cb) => {
  var create = (err) => {
    if (err || !net_interface) return cb(new Error(interface_err));

    var cmd = `nmcli connection add type wifi ifname ${net_interface} con-name "${ssid}" ssid "${ssid}"`;
    exec(cmd, (err, out) => {
      return cb && cb(err);
    })
  }
  net_interface ? create() : get_interface(create);
}

exports.delete_profile = (ssid, cb) => {
  var discard = (err) => {
    if (err || !net_interface) return cb(new Error(interface_err));

    var cmd = `nmcli connection delete "${ssid}"`;
    exec(cmd, (err, out) => {
      return cb && cb(err);
    })
  }
  net_interface ? discard() : get_interface(discard);
}

exports.connect_to_ap = (ssid, cb) => {
  var connect = (err) => {
    if (err || !net_interface) return cb(new Error(interface_err));

    var cmd = `nmcli connection up "${ssid}"`;
    exec(cmd, (err, out) => {
      return cb(err, out);
    });
  }
  net_interface ? connect() : get_interface(connect);
}

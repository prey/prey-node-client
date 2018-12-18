var exec    = require('child_process').exec;
    network = require('./../../providers/network/linux');

var net_interface = null;

var get_interface = (cb) => {
  network.get_first_wireless_interface((err, data) => {
    net_interface = data;
  });
}

exports.enable_wifi = (cb) => {
  var turn_on_wifi = () => {
    var cmd = 'nmcli networking on; nmcli radio wifi on';
    exec(cmd, (err, data) => {
      return cb();
    })
  }
  net_interface ? turn_on_wifi() : get_interface(turn_on_wifi);
}

exports.get_existing_profiles = (cb) => {
  var get_profiles = () => {
    var cmd = 'ls /etc/NetworkManager/system-connections'
    exec(cmd, (err, stdout) => {
      cb(null, stdout.split("\n").slice(0, -1));
    })
  }
  net_interface ? get_profiles() : get_interface(get_profiles);
}

exports.create_profile = (ssid, cb) => {
  var create = () => {
    var cmd = `nmcli connection add type wifi ifname ${net_interface} con-name "${ssid}" ssid "${ssid}"`;
    exec(cmd, (err, out) => {
      return cb && cb(err);
    })
  }
  net_interface ? create() : get_interface(create);
}

exports.delete_profile = (ssid, cb) => {
  var discard = () => {
    var cmd = `nmcli connection delete "${ssid}"`;
    exec('nmcli connection delete ' + '"' + ssid + '"', (err, out) => {
      return cb && cb(err);
    })
  }
  net_interface ? discard() : get_interface(discard);
}

exports.connect_to_ap = (ssid, cb) => {
  var connect = () => {
    var cmd = `nmcli connection up "${ssid}"`;
    exec(cmd, (err, out) => {
      return cb(err, out);
    });
  }
  net_interface ? connect() : get_interface(connect);
}

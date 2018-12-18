var exec         = require('child_process').exec,
    system       = require('./../../../system'),
    run_as_user  = system.run_as_logged_user;

var net_interface = null;

var get_interface = (cb) => {
  var cmd = 'networksetup -listallhardwareports | awk "/Hardware Port: Wi-Fi/,/Ethernet/" | awk "NR==2" | cut -d " " -f 2';
  exec(cmd, (err, data) => {
    if (err) return cb(err);

    net_interface = data.split("\n").slice(0, -1);
    return cb(null, net_interface);
  })
}

exports.enable_wifi = (cb) => {
  console.log("ENABLE WIFI!!")
  var turn_on_wifi = () => {
    var cmd = `networksetup -setairportpower ${net_interface} on`;
    exec(cmd, (err, data) => {
      return cb();
    })
  }
  net_interface ? turn_on_wifi() : get_interface(turn_on_wifi);
}

exports.get_existing_profiles = (cb) => {
  var get_profiles = () => {
    var cmd = `networksetup -listpreferredwirelessnetworks ${net_interface} | awk 'NR>1' | awk '{$1=$1;print}'`
    exec(cmd, (err, stdout) => {
      cb(null, stdout.split("\n").slice(0, -1));
    })
  }
  net_interface ? get_profiles() : get_interface(get_profiles);
}

exports.create_profile = (ssid, cb) => {
  var create = () => {
    var cmd = `networksetup -addpreferredwirelessnetworkatindex ${net_interface} "${ssid}" 0 open`;
    run_as_user(cmd, [], (err) => {
      return cb && cb(err);
    })
  }
  net_interface ? create() : get_interface(create);
}

exports.delete_profile = (ssid, cb) => {
  var discard = () => {
    var cmd = `networksetup -removepreferredwirelessnetwork ${net_interface} "${ssid}"`;
    run_as_user(cmd, [], (err) => {
      return cb && cb(err);
    })
  }
  net_interface ? discard() : get_interface(discard);
}

exports.connect_to_ap = (ssid, cb) => {  // revisar cb si va
  var connect = () => {
    var cmd = `networksetup -setairportnetwork ${net_interface} "${ssid}"`;
    run_as_user(cmd, [], (err, out) => {
      return cb(err, out);
    });
  }
  net_interface ? connect() : get_interface(connect);
}

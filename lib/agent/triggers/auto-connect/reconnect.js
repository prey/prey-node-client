var async        = require('async'),
    common       = require('./../../common'),
    providers    = require('./../../providers'),
    os_name      = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    os_functions = require('./' + os_name),
    logger       = common.logger.prefix('auto-connect');

var previous = null,
    previous_secured_wifi = [],
    connected_to = false;

exports.attempted_wifi = {},
exports.time_between = 20000;
exports.init_profiles = [];

var get_existing_profiles = (cb) => {
  os_functions.get_existing_profiles((err, data) => {
    return cb(null, data);
  });
}

var delete_profile = (ssid, cb) => {
  get_existing_profiles((err, current_profiles) => {
    // Check if the profile isn't original and exists in the current list also if the device is connected to that ap
    if (!ssid || exports.init_profiles.indexOf(ssid) != -1 || current_profiles.indexOf(ssid) == -1 || connected_to.ssid == ssid) {
      return cb(new Error("Nothing to delete " + ssid));
    }
    os_functions.delete_profile(ssid, (err) => {
      if (!err) {
        logger.debug("Profile " + ssid + " succesfuly deleted");
        previous = null;
      }
      return cb && cb(err);
    })
  })
}

var create_profile = (ssid, cb) => {
  get_existing_profiles((err, current_profiles) => {
    if (current_profiles.indexOf(ssid) != -1)
      return cb(new Error("Profile " + ssid + " already exists"));

    os_functions.create_profile(ssid, (err) => {
      if (!err) logger.debug("Profile " + ssid + " succesfuly created");
      cb(null);
    });
  })
}

var connect_to_access_point = (ap, cb) => {
  var connect = () => {
    logger.info("Trying to connect to: " + ap.ssid);
    previous = ap.ssid;
    os_functions.connect_to_ap(ap.ssid, cb);
  }

  // Before attempt to connect it checks if it's already connected
  if (connected_to) {
    delete exports.attempted_wifi[connected_to.mac_address];
    if (previous != connected_to.ssid) {
      delete_profile(previous, (err) => {
        if (err) logger.debug(err.message)
      });
    }
    return cb(new Error("Already connected to: " + connected_to.ssid))
  }

  exports.attempted_wifi[ap.mac_address] ? exports.attempted_wifi[ap.mac_address]++ : exports.attempted_wifi[ap.mac_address] = 1;

  delete_profile(previous, (err) => {
    if (err) logger.debug(err.message)
    create_profile(ap.ssid, (err) => {
      if (err) logger.debug(err.message)
      connect();
    })
  })
}

exports.try_connecting_to = (list, cb) => {
  var array = [];
  list.forEach((ap) => {
    array.push(
      (callback) => {
        setTimeout(() => {
          connect_to_access_point(ap, (err) => {
            if (err && err.message.includes('Already connected')) return callback(err);
            callback();
          })
        }, exports.time_between)
      }
    )
  })

  array.push((callback) => {
    setTimeout(() => {
      callback(new Error("Connection attempted with all the open access points, retrying in 3 minutes..."));
    }, exports.time_between)
  })

  async.series(array, (err) => {
    if (err.message.includes("Connection attempted with all the open access points")) {
      delete_profile(previous, (err) => {
        if (err) logger.info(err.message);
      });
    }
    if (err) {
      previous = null;
      cb(err)
    }
  });
}

exports.get_ap_lists = (cb) => {
  previuos = null;
  if (connected_to) return cb(new Error("Already connected to: " + connected_to.ssid));

  var proceed_with_open_aps = (open, current_profiles) => {
    if (!open || open.length == 0) return cb(new Error('No open access points found. Retrying in 10'))

    var final_list = [];

    // Filter the 3 times attempted access points
    open.forEach((ap) => {
      if (!(ap.mac_address in exports.attempted_wifi) || exports.attempted_wifi[ap.mac_address] < 3) {
        // Put open ap at the beginning of the list if the device was previously connected to it
        current_profiles.indexOf(ap.ssid) > -1 ? final_list.unshift(ap) : final_list.push(ap);
      } else {
        logger.debug("3 attempts reached for: " + ap.ssid);
      }
    })

    cb(null, final_list);
  }

  // Make sure Wi-Fi is on
  os_functions.enable_wifi(() => {
    // Scan the open and secured access points
    providers.get('categorized_access_points_list', (err, list) => {
      if (err || !list) {
        return cb(new Error('No open access points found. Retrying in 10'))
      }

      var open    = list[0],
          secured = list[1];

      exports.get_existing_profiles((err, current_profiles) => {
        if (err || !secured || secured.length == 0) return proceed_with_open_aps(open, current_profiles);

        // Check if the device previously connected to at least one of the secured ap's
        var known_secured_wifi = [];
        secured.forEach((ap) => {
          current_profiles.forEach((ssid) => {
            if (ssid.trim() == ap.ssid.trim())
              known_secured_wifi.push(ap.ssid);
          })
        })

        var new_secured_wifi = known_secured_wifi.filter(x => previous_secured_wifi.indexOf(x) == -1)
        previous_secured_wifi = previous_secured_wifi.concat(new_secured_wifi);

        if (new_secured_wifi.length > 0)
          return cb(new Error('There is a secured known network, waiting for the device to autoconnect'))

        console.log("OPEN", open)

        proceed_with_open_aps(open, current_profiles);

      });
    })
  })
}

exports.connected = (ap) => {
  previous_secured_wifi = [];
  connected_to = false;
  if (ap) connected_to = ap;
}

exports.enable_wifi = (cb) => {
  os_functions.enable_wifi(cb);
}

get_existing_profiles((err, profiles) => {
  exports.init_profiles = profiles;
})

exports.create_profile = create_profile;
exports.delete_profile = delete_profile;
exports.get_existing_profiles = get_existing_profiles;
exports.connect_to_access_point = connect_to_access_point
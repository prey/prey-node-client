var async        = require('async'),
    common       = require('./../../common'),
    providers    = require('./../../providers'),
    os_name      = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    os_functions = require('./' + os_name),
    logger       = common.logger.prefix('auto-connect');

var previous = null,
    sleeping = false,
    connected = true,
    connected_to = false;

exports.attempted_wifi = {},
exports.time_between = 20000;
exports.init_profiles = [];

var validate_procedure = () => {
  var error = null;
  if (connected) error = new Error("Already connected" + (connected_to ? " to: " + connected_to.ssid : ""));
  if (sleeping) error = new Error("Device on sleeping state, stopping autoconnect");

  return error;
}

var get_existing_profiles = (cb) => {
  os_functions.get_existing_profiles((err, data) => {
    return cb(null, data);
  });
}

var delete_profile = (ap, cb) => {
  get_existing_profiles((err, current_profiles) => {
    if (!ap || !ap.ssid) return cb(new Error("Nothing to delete"));

    // Check if the profile isn't original and exists in the current list also if the device is connected to that ap
    if (exports.init_profiles.indexOf(ap.ssid) != -1
      || current_profiles.indexOf(ap.ssid) == -1
      || (connected_to && connected_to.ssid == ap.ssid)
      || ap.security)
      return cb(new Error("Nothing to delete " + ap.ssid));

    os_functions.delete_profile(ap.ssid, (err) => {
      if (!err) {
        logger.debug("Profile " + ap.ssid + " successfully deleted");
        previous = null;
      }
      return cb && cb(err);
    })
  })
}

var create_profile = (ap, cb) => {
  get_existing_profiles((err, current_profiles) => {
    if (current_profiles.indexOf(ap.ssid) != -1)
      return cb(new Error("Profile " + ap.ssid + " already exists"));

    os_functions.create_profile(ap.ssid, (err) => {
      if (!err) logger.debug("Profile " + ap.ssid + " successfully created");
      cb(null);
    });
  })
}

var connect_to_access_point = (ap, cb) => {
  var connect = () => {
    logger.info("Trying to connect to: " + ap.ssid);
    previous = ap;
    os_functions.connect_to_ap(ap.ssid, cb);
  }

  if (err = validate_procedure()) return cb(err);

  if (ap.security) {
    delete_profile(previous, (err) => {
      if (err) logger.debug(err.message);
      return connect();
    })
  } else {
    exports.attempted_wifi[ap.ssid] ? exports.attempted_wifi[ap.ssid]++ : exports.attempted_wifi[ap.ssid] = 1;

    delete_profile(previous, (err) => {
      if (err) logger.debug(err.message);
      create_profile(ap, (err) => {
        if (err) logger.debug(err.message);
        else connect();
      })
    })
  }
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

  if (err = validate_procedure()) return cb(err);

  var filter_wifi_list = (list) => {
    var filtered_list = [];

    if (list.length == 0) return filtered_list;
    filtered_list = list.filter((obj, pos, arr) => {
      return list.map(mapObj => mapObj.ssid).indexOf(obj.ssid) === pos;
    });
    return filtered_list;
  }

  var proceed_with_open_aps = (open, secured, current_profiles) => {
    if (!open || open.length == 0) return cb(new Error('No open access points found. Retrying in 10'))

    var final_list = [];

    // Filter the 3 times attempted access points
    open.forEach((ap) => {
      if (!(ap.ssid in exports.attempted_wifi) || exports.attempted_wifi[ap.ssid] < 3) {
        // Put open ap at the beginning of the list if the device was previously connected to it
        current_profiles.indexOf(ap.ssid) > -1 ? final_list.unshift(ap) : final_list.push(ap);
      } else {
        logger.debug("3 attempts reached for: " + ap.ssid);
      }
    })

    secured.forEach((ap) => {
      final_list.unshift(ap);
    })

    cb(null, final_list);
  }

  providers.get('categorized_access_points_list', (err, list) => {
    if (err || !list) {
      return cb(new Error('No open access points found. Retrying in 10'))
    }

    var open    = list[0],
        secured = list[1];

    exports.get_existing_profiles((err, current_profiles) => {
      if (err || !secured || secured.length == 0) return proceed_with_open_aps(open, [], current_profiles);

      // Check if the device previously connected to at least one of the secured ap's
      var known_secured_wifi = [];
      secured.forEach((ap) => {
        current_profiles.forEach((ssid) => {
          if (ssid.trim() == ap.ssid.trim())
            known_secured_wifi.push(ap);
        })
      })

      secured = filter_wifi_list(known_secured_wifi);
      open = filter_wifi_list(open);

      proceed_with_open_aps(open, secured, current_profiles);

    });
  })
}

exports.is_connected = (value) => {
  if (value) connected = true;
  else {
    connected = false;
    connected_to = null;
  }
}

exports.is_sleeping = (value) => {
  if (value) sleeping = true;
  else sleeping = false;
}

exports.is_connected_to = (ap) => {
  connected_to = ap;
  delete exports.attempted_wifi[connected_to.ssid];

  if (previous && previous.ssid && previous.ssid != connected_to.ssid) {
    delete_profile(previous, (err) => {
      if (err) logger.debug(err.message)
    });
  }
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
var fs           = require('fs'),
    join         = require('path').join,
    async        = require('async'),
    os_name      = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    os_functions = require('./' + os_name),
    system       = require('./../../../system'),
    run_as_user  = system.run_as_logged_user,
    common       = require('./../../common'),
    logger       = common.logger.prefix('reconnect'),
    providers    = require('./../../providers');

var attempted_wifi = {},
    previous = null,
    connected_to = false;

exports.time_between = 15000;
exports.init_profiles;

var get_existing_profiles = function(cb) {
  os_functions.get_existing_profiles(function(err, data) {
    return cb(null, data);
  });
}

var delete_profile = function(ssid, cb) {
  get_existing_profiles(function(err, current_profiles) {
    // Check if the profile isn't original and exists in the current list also if the device is connected to that ap
    if (!ssid || exports.init_profiles.indexOf(ssid) != -1 || current_profiles.indexOf(ssid) == -1 || connected_to.ssid == ssid) {
      return cb(new Error("Nothing to delete " + ssid));
    }

    os_functions.delete_profile(ssid, function(err) {
      if (!err) {
        logger.debug("Profile " + ssid + " succesfuly deleted");
        previous = null;
      }
      return cb && cb(err);
    })

  })
}

var create_profile = function(ssid, cb) {
  get_existing_profiles(function(err, current_profiles) {
    if (current_profiles.indexOf(ssid) != -1)
      return cb(new Error("Profile " + ssid + " already exists"));

    os_functions.create_profile(ssid, function(err) {
      if (!err) logger.info("Profile " + ssid + " succesfuly created");
      cb(null);
    });
  })
}

var connect_to_access_point = function(ap, cb) {
  var connect = function() {
    previous = ap.ssid;
    os_functions.connect_to_ap(ap.ssid, cb);
  }

  // Before attempt to connect it checks if it's already connected
  if (connected_to) {
    delete attempted_wifi[connected_to];
    if (exports.init_profiles.indexOf(connected_to.ssid)) {
      delete_profile(previous, function(err) {
        if (err) logger.info(err.message)
      });
    }
    return cb(new Error("Already connected to: " + connected_to.ssid))
  }

  attempted_wifi[ap.mac_address] ? attempted_wifi[ap.mac_address]++ : attempted_wifi[ap.mac_address] = 1;

  delete_profile(previous, function(err) {
    if (err) logger.info(err.message)
    create_profile(ap.ssid, function(err) {
      if (err) logger.info(err.message)
      connect();
    })
  })
}

exports.try_connecting_to = function(list, cb) {
  var array = [];
  list.forEach(function(ap) {
    array.push(
      function(callback) {
        setTimeout(function() {
          connect_to_access_point(ap, function(err) {
            if (err && err.message.includes('Already connected')) return callback(err);
            callback();
          })
        }, exports.time_between)
      }
    )
  })

  array.push(function(callback) {
    callback(new Error("TERMINO"))
  })

  async.series(array, function(err) {
    if (err.message.includes("TERMINO")) {
      delete_profile(previous, function(err) {
        if (err) logger.info(err.message);
      });
    }
    if (err) {
      console.log("ERRORRRR!!!", err.message)
      previous = null;
      cb(err)
    }
  });

}

exports.get_open_ap_list = function(cb) {
  // Scan the open access points
  providers.get('open_access_points_list', function(err, list) {
    if (err || !list || list.length == 0) {
      return cb(new Error('No open access points found. Retrying in 10'))
    }

    var final_list = [];

    // Filter the 3 times attempted access points 
    list.forEach(function(ap) {
      if (!(ap.mac_address in attempted_wifi) || attempted_wifi[ap.mac_address] < 3) {
        final_list.push(ap);
      } else {
        logger.debug("3 attempts reached for: " + ap.ssid);
      }
    })

    console.log("FINAL LIST: ", final_list)
    cb(null, final_list);
  })
}

exports.connected = function(ap) {
  connected_to = false;
  if (ap) connected_to = ap;
}

get_existing_profiles(function(err, profiles) {
  console.log("INIT PROFILES!!!", profiles)
  exports.init_profiles = profiles;
})

exports.get_existing_profiles = get_existing_profiles;
exports.create_profile = create_profile;
exports.delete_profile = delete_profile;
exports.connect_to_access_point = connect_to_access_point
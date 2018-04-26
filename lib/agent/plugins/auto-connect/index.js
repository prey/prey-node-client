var fs           = require('fs'),
    join         = require('path').join,
    async        = require('async'),
    os_name      = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    os_functions = require('./' + os_name),
    common       = require('./../../common'),
    logger       = common.logger.prefix('reconnect'),
    providers    = require('./../../providers');

var attempted_wifi = {},
    previous = null,
    connected_to = false,
    time_between = 15000,
    init_profiles;

var get_existing_profiles = function(cb) {
  os_functions.get_existing_profiles(function(err, data) {
    return cb(data);
  });
}

var delete_profile = function(ssid, cb) {
  get_existing_profiles(function(err, new_profiles) {
    // Check if the profile isn't original and exists in the current list
    if (!ssid || init_profiles.indexOf(ssid) != -1 || new_profiles.indexOf(ssid) == -1) {
      logger.info("Nothing to delete " + ssid);
      return cb();
    }

    os_functions.delete_profile(function(err) {
      if (!err) logger.debug("Profile " + ssid + " succesfuly deleted")
    })

  })
}

var create_profile = function(ssid, cb) {
  // CHEQUEAR Q EL PROFILE NO EXISTA EN EL LISTADO ACTUAL
   
  // We previously delete the profile from the previous attempt
  delete_profile(previous, function(err) {
    os_functions.create_profile(function(err) {
      if (!err) logger.info("Profile " + ssid + " succesfuly created")
    });
  })
}

var connect_to_access_point = function(ap, cb) {
  var system    = require('./../../system'),
      run_as_user = system.run_as_logged_user;

  var connect = function() {
    previous = ap.ssid;

    console.log("CONNECTING TO:", ap.ssid)
    os_functions.connect_to_ap(ap.ssid, function() {
      console.log("oa")
    });
  }

  // Before attempt to connect it checks if it's already connected
  if (connected_to) {
    delete attempted_wifi[connected_to];
    if (init_profiles.indexOf(connected_to.ssid)) {
      // DELETE PROFILE ?
      previous = null;
    }
    return cb(new Error("Already connected to: " + connected_to.ssid))
  }

  attempted_wifi[ap.mac_address] ? attempted_wifi[ap.mac_address]++ : attempted_wifi[ap.mac_address] = 1;
  console.log("ATTEMPTED LIST!!!", attempted_wifi)

  create_profile(ap.ssid, function(err) {
    connect();
  })
}

var try_connecting = function(list) {
  var array = [];
  list.forEach(function(ap) {
    array.push(
      function(callback) {
        setTimeout(function() {
          connect_to_access_point(ap, function(err) {
          if (err) return callback(err);
          callback();
          })
        }, time_between)
      }
    )
  })

  array.push(function(callback) {
    callback(new Error("TERMINO"))
  })

  async.series(array, function(err) {
    if (err.message.includes("TERMINO")) {
      console.log("RECORRIÓ TODAS LAS REDES!!!! RETRYING IN 10!!");
      delete_profile(previous, function(err) {
        timer2 = setTimeout(exports.reconnect, 10000)
      });
    }
    if (err) console.log("ERRORRRR!!!", err.message)
  });

}

exports.reconnect = function() {
  // Scan the open access points
  providers.get('open_access_points_list', function(err, list) {
    if (err || !list) {
      console.log('No open access point found. Retrying in 10')
      // return done(err || new Error('No open access point found.'));
      return setTimeout(exports.reconnect, 10000)
    }

    var final_list = [];

    // Filter the 3 times attempted access points 
    list.forEach(function(ap) {
      if (!(ap.mac_address in attempted_wifi) || attempted_wifi[ap.mac_address] < 3) {
        final_list.push(ap);
      } else {
        logger.debug("3 attempts reached for: " + ap.ssid);
        // delete_profile(wifi.ssid);  // REVISAR SI VA
      }
    })

    console.log("FINAL LIST: ", final_list)
    try_connecting(final_list);
  })
}

exports.connected = function(ap) {
  connected_to = false;
  if (ap) connected_to = ap;
}

get_existing_profiles(function(err, profiles) {
  console.log("INIT PROFILES!!!", profiles)
  init_profiles = profiles;
})
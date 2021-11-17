"use strict"

var join      = require('path').join,
    needle    = require('needle'),
    platform  = require(join(__dirname, process.platform)),
    common    = require('./../../common'),
    config    = common.config,
    providers = require('./../../providers'),
    keys      = require('./../../plugins/control-panel/api/keys'),
    logger    = require('../../common').logger.prefix('geo');

var GEO_ENDPOINT = 'https://solid.preyproject.com/geo',
    proxy;

function geoip(cb) {
  logger.info("Getting location via geoip");

  needle.get('http://ipinfo.io/geo', function(err, resp, body) {
    if (!body || !body.loc) {
      return cb(err || new Error('Unable to get location from IP.'));
    }

    logger.debug("Got location via geoip");

    var res = {
      lat: parseFloat(body.loc.split(',')[0]),
      lng: parseFloat(body.loc.split(',')[1]),
      method: 'geoip'
    }

    cb(null, res);
  });
}

function wifi(cb) {
  logger.info("Getting location via wifi strategy");

  providers.get('access_points_list', function(err, list) {
    if (err) return cb(err);

    send_data(list, cb);
  });

  function send_data(list, cb) {

    logger.debug("Sending AP data to location service");

    var aps = [];

    list.slice(0, 30).forEach(function(ap) {
      var current_ap = {
        "macAddress": ap.mac_address,
        "ssid": ap.ssid,
        "signalStrength": ap.signal_strength,
        "channel": ap.channel
      }
      aps.push(current_ap);
    });

    var data = {
      "wifiAccessPoints": aps
    }
    proxy = config.get('try_proxy');

    var opts = {
      user_agent: common.system.user_agent,
      username: keys.get().device,
      password: keys.get().api,
      json : true
    }
    if (proxy) opts.proxy = proxy;

    needle.post(GEO_ENDPOINT, data, opts, function(err, resp, body) {
      if (err) return cb(err);

      check_response(body, function(err, stdout) {
        if (err) return cb(err);

        // If the response includes the location already it's immediately processed
        if (stdout.geolocation)
          return process_response(stdout.geolocation, cb);

        if (!stdout.endpoint) return cb(new Error("No location endpoint available"));
        var url = stdout.endpoint.url,
            provider = stdout.endpoint.provider;

        var options = {
          user_agent: stdout.endpoint['user-agent'],
          json : true
        }
        if (proxy) opts.proxy = proxy;

        // Get the location using the url and mac addresses data
        needle.post(url, data, options, function(err, resp, body) {
          if (err) return cb(err);

          check_response(body, function(err, stdout) {
            if (err) return cb(err);

            var geolocation = stdout;
            var loc_data = {
              "geolocation": geolocation,
              "wifiAccessPoints": aps,
              "provider": provider
            }
            var opts = {
              user_agent: common.system.user_agent,
              json : true
            }
            if (proxy) opts.proxy = proxy;

            // Send the new location info and process it
            needle.put(GEO_ENDPOINT, loc_data, opts, function(err, resp) {
              logger.debug("Sending location data to prey service")
              if (err) return cb(err)
              process_response(geolocation, cb);
            });

          });

        });

      });

    });

  }

  function check_response(body, cb) {
    var output;

    if (typeof body === 'object') {
      output = body;
    } else {
      try {
        output = JSON.parse(body);
      } catch (e) {
        return cb(e);
      }
    }
    return cb(null, output);
  }

  function process_response(coords, cb) {
    logger.info("Processing wifi data response");

    if (!coords.location || (!coords.location.lat && !coords.location.latitude))
      return cb(new Error("Couldn't get any geoposition data. Try moving around a bit."));

    var data = {
      lat: coords.location.lat || coords.location.latitude,
      lng: coords.location.lng || coords.location.longitude,
      accuracy: coords.accuracy || coords.location.accuracy,
      method: 'wifi'
    };

    return cb(null, data);
  }
}

function geonative(cb) {
  logger.info("Getting location via native geoloc");

  platform.get_location(function(err, res) {
    if (err) {
      return cb(err);
    }

    logger.debug("Got location via native geoloc");

    // Avoid adding property in each native geoloc implementation
    res.method = 'native';

    return cb(null, res);
  });
}

module.exports = {
  'geoip' : geoip,
  'wifi'  : wifi,
  'native': geonative
};

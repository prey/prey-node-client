"use strict"

var join = require('path').join,
    needle = require('needle'),
    get_agent = require('random-ua').generate,
    platform = require(join(__dirname, process.platform)),
    providers = require('./../../providers'),
    logger = require('../../common').logger.prefix('geo');

var GEO_ENDPOINT = 'solid.preyproject.com/geo';

function geoip(cb) {
  logger.debug("Getting location via geoip");

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

function google(cb) {
  logger.debug("Getting location via google api");

  providers.get('access_points_list', function(err, list) {
    if (err) return cb(err);

    send_data(list, cb);
  });

  function send_data(list, cb) {

    logger.debug("Sending AP data to Google API");

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

    var opts = {
      user_agent: get_agent()
    }

    needle.post(GEO_ENDPOINT, data, { json : true }, function(err, resp, body) {
      if (err) return cb(err)

      if (body.geolocation)
        return process_response(body.location, cb);

      if (!body.endpoint) return cb();
      var url = body.endpoint.url;

      var options = {
        user_agent: body.endpoint['user-agent'],
        json : true
      }

      needle.post(url, data, options, function(err, resp, body) {
        if (err) return cb(err)

        var geolocation = body;
        var loc_data = {
          "geolocation": geolocation,
          "wifiAccessPoints": aps
        }

        needle.put(GEO_ENDPOINT, loc_data, { json: true }, function(err, resp) {
          if (err) return cb(err)
          process_response(geolocation, cb);
        })

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
    logger.debug("Processing Google API response");

    if (!coords.location || (!coords.location.lat && !coords.location.latitude))
      return cb(new Error("Couldn't get any geoposition data. Try moving around a bit."));

    logger.debug("Got location via Google API");

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
  logger.debug("Getting location via native geoloc");

  platform.get_location(function(err, res) {
    if (err) {
      return cb(err);
    }

    logger.debug("Got location via native geoloc");

    // Avoid adding property in each native geoloc implementation
    res.method = 'geonative';

    return cb(null, res);
  });
}

module.exports = {
  'geoip': geoip,
  'google': google,
  'native': geonative
};

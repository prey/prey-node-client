"use strict"

var join = require('path').join,
    needle = require('needle'),
    get_agent = require('random-ua').generate,
    platform = require(join(__dirname, process.platform)),
    providers = require('./../../providers'),
    logger = require('../../common').logger.prefix('geo');

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
        "signalStrength": ap.signal_strength,
        "channel": ap.channel
      }
      aps.push(current_ap);
    });

    var data = {
      "considerIp": false,
      "wifiAccessPoints": aps
    }

    var opts = {
      user_agent: get_agent()
    }

    needle.get('solid.preyproject.com/geo', opts, function(err, resp, body) {
      if (err) return cb(err)

      var response = JSON.parse(body);
      var url = response.url;
      var options = {
        user_agent: response['user_agent'],
        json : true
      }

      needle.post(url, data, options, function(err, resp, body) {
        if (err) return cb(err)
        process_response(body, cb);
      })

    });

  }

  function process_response(body, cb) {
    logger.debug("Processing Google API response");

    var coords;

    if (typeof body === 'object') {
      coords = body;
    } else {
      try {
        coords = JSON.parse(body);
      } catch (e) {
        return cb(e);
      }
    }

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

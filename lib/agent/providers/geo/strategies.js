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
    if (!body || body.log) {
      return cb(err || new Error('Unable to get location from IP.'));
    }

    logger.debug("Got location via geoip");

    var res = {
      lat: parseFloat(body.loc.split(',')[0]),
      lng: parseFloat(body.loc.split(',')[1])
    }

    cb(null, res);
  })
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
      var str = 'wifi=mac:' + ap.mac_address + '|ssid:' + encodeURIComponent(ap.ssid);
      str += '|ss:' + ap.signal_strength;
      aps.push(str);
    });

    var opts = {
        user_agent: get_agent()
      },
      url = 'https://maps.googleapis.com/maps/api/browserlocation/json?',
      query = url + 'browser=true&sensor=true&' + aps.join('&');

    needle.get(query, opts, function(err, resp, body) {
      if (err) return cb(err);
      process_response(body, cb);
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

    return cb(null, res);
  });
}

module.exports = {
  'geoip': geoip,
  'google': google,
  'native': geonative
};

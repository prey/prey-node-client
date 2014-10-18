"use strict";

var join     = require('path').join,
    needle   = require('needle'),
    platform = require(join(__dirname, process.platform));

function geoip(cb) {
  // console.log('Getting GeoIP...');
  needle.get('http://ipinfo.io/geo', function(err, resp, body) {
    if (!body || body.log)
      return cb(err || new Error('Unable to get location from IP.'))

    var res = {
      lat: parseFloat(body.loc.split(',')[0]),
      lng: parseFloat(body.loc.split(',')[1])
    }

    cb(null, res);
  })
}

exports.get_location = function(cb) {
  platform.get_location(function(err, res) {
    if (res) return cb(null, res);

    geoip(cb);
  })
}

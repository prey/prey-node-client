"use strict";

//////////////////////////////////////////
// Prey JS Geo Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var join      = require('path').join,
    exec      = require('child_process').exec,
    client    = require('needle'),
    get_agent = require('random-ua').generate,
    providers = require('./../../providers');

var get_using_corelocation = function(cb) {

  // whereami bin from https://github.com/robmathers/WhereAmI
  var bin = join(__dirname, 'darwin', 'whereami');

  exec(bin, function(err, out) {
    if (err) return cb(err);

    if (!out.toString().match('Latitude'))
      return cb(new Error('Unable to get geoposition data using CoreLocation.'));

    var match, str = out.toString();

    var res = {
      lat: str.match(/Latitude: (.+)/)[1],
      lng: str.match(/Longitude: (.+)/)[1]
    }

    if (match = str.match(/\nAccuracy.*: (.+)/)) {
      res.accuracy = match[1];
    } else if (match = str.match(/Horizontal Accuracy.*: (.+)/)) {
      res.accuracy = match[1];
      res.vertical_accuracy = str.match(/Vertical Accuracy.*: (.+)/)[1];
      res.altitude = str.match(/Altitude.*: (.+)/)[1];
    }

    cb(null, res);
  })

}

var process_response = function(body, cb){
  var coords;

  if (typeof body === 'object') {
    coords = body;
  } else {
    try {
      coords = JSON.parse(body);
    } catch(e) {
      return cb(e);
    }
  }

  if (!coords.location || (!coords.location.lat && !coords.location.latitude))
    return cb(new Error("Couldn't get any geoposition data. Try moving around a bit."));

  var data = {
    lat: coords.location.lat  || coords.location.latitude,
    lng: coords.location.lng  || coords.location.longitude,
    accuracy: coords.accuracy || coords.location.accuracy,
    method: 'wifi'
  };

  cb(null, data);
};


exports.send_data = function(list, cb){

  var aps = [];

  list.slice(0, 30).forEach(function(ap){
    var str = 'wifi=mac:' + ap.mac_address + '|ssid:' + encodeURIComponent(ap.ssid);
    str += '|ss:' + ap.signal_strength;
    aps.push(str);
  });

  var opts  = { user_agent: get_agent() },
      url   = 'https://maps.googleapis.com/maps/api/browserlocation/json?',
      query = url + 'browser=true&sensor=true&' + aps.join('&');

  client.get(query, opts, function(err, resp, body) {
    if (err) return cb(err);
    process_response(body, cb);
  });

};

exports.get_location = function(cb) {

  if (process.platform == 'darwin')
    return get_using_corelocation(cb);

  providers.get('access_points_list', function(err, list) {
    if (err) return cb(err);

    exports.send_data(list, cb);
  });

};

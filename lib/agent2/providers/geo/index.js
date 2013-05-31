"use strict";

//////////////////////////////////////////
// Prey JS Geo Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var client    = require('needle'),
    providers = require('./../../providers');

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
    accuracy: coords.accuracy || coords.location.accuracy
  };

  cb(null, data);
};


exports.send_data = function(list, cb){

  var aps = [];

  list.forEach(function(ap){
    var str = 'wifi=mac:' + ap.mac_address + '|ssid:' + encodeURIComponent(ap.ssid);
    str += '|ss:' + ap.signal_strength;
    aps.push(str);
  })

  var opts = {},
      url = 'https://maps.googleapis.com/maps/api/browserlocation/json?',
      query = url + 'browser=true&sensor=true&' + aps.join('&');

  client.get(query, opts, function(err, resp, body) {
    if (err) return cb(err);
    process_response(body, cb);
  });

}

exports.get_location = function(callback){

  providers.get('access_points_list', function(err, list) {
    if (err) return callback(err);

    exports.send_data(list, callback);
  });

};

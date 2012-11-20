"use strict";

//////////////////////////////////////////
// Prey JS Geo Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var client = require('needle'),
    network = _ns('network'),
    helpers = _ns('helpers');

var process_response = function(response, body, cb){
  var coords;

  if (body instanceof String) {
    try {
      coords = JSON.parse(body);
    } catch(e) {
      return cb(_error(e));
    }
  } else {
    coords = body;
  }

  if (!coords.location || !coords.location.latitude)
    return cb(_error("Couldn't get any geoposition data. Try moving around a bit."));

  var coords_data = {
    lat: coords.location.latitude,
    lng: coords.location.longitude,
    accuracy: coords.location.accuracy
  };

  cb(null, coords_data);

};

module.exports.get_coordinates = function(callback){

  network.get_access_points_list(function(err, list) {

    // var list = [{signal_strength : 9, mac_address : "00-24-6c-a9-01-51", age: 0}];

    if (err) return callback(err);

    var data = JSON.stringify({
      version: '1.1.0',
      host: 'maps.google.com',
      request_address: true,
      wifi_towers: list
    });

    var opts = { headers: {'Content-Type' : 'application/json'} },
        url = 'https://www.google.com/loc/json';

    client.post(url, data, opts, function(err, resp, body) {
      if (err) return callback(_error(err));
      console.log(resp);
      process_response(resp, body, callback);
    });
  });

};

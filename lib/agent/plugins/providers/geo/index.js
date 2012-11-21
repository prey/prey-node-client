"use strict";

//////////////////////////////////////////
// Prey JS Geo Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var client  = require('needle'),
    network = require('./../network');

var process_response = function(response, body, cb){
  var coords;

  if (typeof coords === 'object') {
    coords = body;
  } else {
    try {
      coords = JSON.parse(body);
    } catch(e) {
      return cb(e);
    }
  }

  if (!coords.location || !coords.location.latitude)
    return cb(new Error("Couldn't get any geoposition data. Try moving around a bit."));

  var coords_data = {
    lat: coords.location.latitude,
    lng: coords.location.longitude,
    accuracy: coords.location.accuracy
  };

  cb(null, coords_data);

};


exports.send_data = function(list, cb){

  // var list = [{signal_strength : 9, mac_address : "00-24-6c-a9-01-51", age: 0}];

  var data = JSON.stringify({
    version: '1.1.0',
    host: 'maps.google.com',
    request_address: true,
    wifi_towers: list
  });

  var opts = { parse: false, headers: {'Content-Type' : 'application/json'} },
      url = 'https://www.google.com/loc/json';

  client.post(url, data, opts, function(err, resp, body) {
    if (err) return cb(err);
    process_response(resp, body, cb);
  });

}

exports.get_coordinates = function(callback){

  network.get_access_points_list(function(err, list) {
    if (err) return callback(err);

    exports.send_data(list, callback);
  });

};

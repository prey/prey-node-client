"use strict";

//////////////////////////////////////////
// Prey JS Geo Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var client = require('needle'),
    async = require('async'),
    Network = _ns('network');

var process_response = function(response, body,callback){
  var coords;
  if (body instanceof String) {
    try {
      coords = JSON.parse(body);
    } catch(e) {
      return callback(_error(e));
    }
  } else {
    coords = body;
  }

  if (coords.location && coords.location.latitude) {
    var coords_data = {
      lat: coords.location.latitude,
      lng: coords.location.longitude,
      accuracy: coords.location.accuracy
    };
    callback(null, coords_data);
  } else
    callback(_error("Couldn't get any geoposition data. Try moving around a bit."));
};


var Geo = function(){

  /**
   * I don't think this should be memoized as if they do 'move around a bit'
   * it's not going to make a lot of difference
   **/
  this.get_coordinates = function(callback){
    Network.get_access_points_list(function(err, aps_list) {

      // var aps_list = [{signal_strength : 9, mac_address : "00-24-6c-a9-01-51", age: 0}];

      if (err) return callback(err);

      var data = JSON.stringify({
        version: '1.1.0',
        host: 'maps.google.com',
        request_address: true,
        wifi_towers: aps_list
      });

      var hdrs = {headers: {'Content-Type' : 'application/json'}},
          url = "https://www.google.com/loc/json";
      
      client.post(url,data,hdrs,function(err,resp,body) {
        if (err) return callback(_error(err));
        
        process_response(resp,body,callback);
      });          
    });
  };

  this.get_coordinates.arity = 0;
};

module.exports = new Geo();

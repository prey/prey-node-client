"use strict";

//////////////////////////////////////////
// Prey Bandwidth Provider
// Written by Tomas Pollak
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var async   = require('async'),
    network = require('./../network'),
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    os_functions = require('./' + os_name),
    max_samples = 3;

var parseBytes = function(bytes){
  if (bytes > 1048576)
    return (bytes/(1024*1024)).toString().substring(0,4) + " MB/s";
  else
    return (bytes/1024).toString().substring(0,5) + " KB/s";
};

var average = function(a){
  var total = 0;
  a.forEach(function(e){
    total += e;
  });
  return total/a.length;
};

var differentials = function(a) {
  var d = [];
  for (var i = 1; i < a.length; i++)
    d.push(a[i] - a[i-1]);
  return d;
};

var averages = function(a) {
  return parseBytes(average(differentials(a)));
};

/**
 * callsback  {in:number, out:number} averages for the active network interface
 **/
exports.get_bandwidth_usage = function(callback) {

  var bag = {
    sampled: 0,
    sent: [],
    received: []
  };

  network.get_active_network_interface(function(err, nic) {
    if (err) return callback(err);

    var sample = function(callback) {
      callback.data = bag;
      os_functions.sample(nic.name, callback);
    };

    async.whilst(function() {
      return bag.sampled < max_samples;
    },
    sample,
    function(err) {
      if (err) return callback(err);

      var data = {
        in:  averages(bag.received),
        out: averages(bag.sent)
      }

      callback(null, data);
    });

  });

};

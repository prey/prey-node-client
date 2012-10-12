//////////////////////////////////////////
// Prey JS Hardware Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

"use strict";

var
 common = _ns("common"),
 os = require('os'),
 os_functions = require('./platform/' + common.os_name),
 async = require("async"),
 helpers = _ns('helpers'),
 exp = module.exports;

var macs = [];

exp.get_processor_info = function(callback) {
  var cpus = os.cpus();
  var cpu_info = {
    model: cpus[0].model,
    speed: cpus[0].speed,
    cores: cpus.length
  };
  callback(null,cpu_info);
};

exp.get_processor_info.arity = 0;

/**
 * There are no parameters to create a memoized hash key on so supply "key" as default in
 * optional hasher function.
 **/
exp.get_firmware_info = helpers.memoize(function(callback){
  os_functions.get_firmware_info(callback);
},function() { return "key"; });

exp.get_firmware_info.arity = 0;

exp.get_first_mac_address = function(callback){
  callback(null,macs[0]);
};

exp.get_first_mac_address.arity = 0;

exp.get_broadcast_address = helpers.memoize(function(nic_name, callback) {
  os_functions.broadcast_address(nic_name,callback);
});

exp.get_active_nic_names = function(callback) {
  os_functions.get_active_nic_names(callback);
};

exp.get_active_nic_names.arity = 0;

/**
 * There are no parameters to create a memoized hash key on so supply "key" as default in
 * optional hasher function.
 **/
exp.get_network_interfaces_list = helpers.memoize(function(callback) {
  if (!os.networkInterfaces()) {
    callback(_error("No OS interface"));
    return;
  }
  
  var
  nics = os.networkInterfaces(),
  validNics = os_functions.validNics(Object.keys(nics)); // array of valid names

  if (validNics.length === 0) {
    callback(_error("No valid nics"));
    return;
  }

  async.parallel(validNics.map(function(name) {
    return function(ascb) {
      var ipv4nic = nics[name].filter(function(n) { return n.family === "IPv4"; });
      exp.get_mac_address(name,function(err, mac) {
        var obj = {};
        obj.mac = mac;
        obj.name = name;
        if (ipv4nic.length > 0) {
          obj.ip_address = ipv4nic[0].address;
        }
        
        exp.get_broadcast_address(name,function(err, broadcast) {
          obj.broadcast_address = broadcast;
          ascb(null,obj);
        });
      });
    };
  }),callback);
},function() { return "key"; });

/**
 * 
 **/
exp.get_mac_address = helpers.memoize(function(nic_name, callback) {
  os_functions.mac_address(nic_name,function(err, mac) {     
    if (err) return callback(_error(err));

    var mac_address_regexp = /^([0-9a-f]{2}[:\-]){5}([0-9a-f]{2})$/i;
    if (!mac_address_regexp.test(mac)) {
      callback(_error('Malformed mac',mac));
      return;
    }
    macs.push(mac);
    callback(null,mac);
  });  
});




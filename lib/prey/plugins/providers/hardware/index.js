//////////////////////////////////////////
// Prey JS Hardware Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
    util = require('util'),
    os = require('os'),
    exec = require('child_process').exec,
    os_functions = require('./platform/' + common.os_name),
    async = require("async");

var Hardware = function() {

  var self = this;

  this.get_processor_info = function(callback) {

    var cpus = os.cpus();

    var cpu_info = {
      model: cpus[0].model,
      speed: cpus[0].speed,
      cores: cpus.length
    };

    callback(null, cpu_info);

  };

  this.get_firmware_info = function(callback){
    os_functions.get_firmware_info(function(err, data){
      if(!data || Object.keys(data) === 0) {
        callback(err);
      } else {
        callback(null, data);
      }
    });
  };

  this.get_network_interfaces_list = function(callback) {
    // old versions of node don't have this method
    if(!os.networkInterfaces) {
      return callback(new Error("os.networkInterfaces not found!"));
    }

    var nics = os.networkInterfaces();

    if (Object.keys(nics).length === 1 && (nics.lo0 || nics.lo)) {
      return callback(new Error("No (active) network interfaces found."));
    }
    
    async.parallel(Object.keys(nics).map(function(name) {
      return function(ascb) {
        var ipv4nic = nics[name].filter(function(n) { return n.family === "IPv4"; });
        self.get_mac_address(name,function(mac) {
          var obj = {};
          obj.name = name;
          if (ipv4nic.length > 0) {
            obj.ip_address = ipv4nic[0].address;
          }
          ascb(null,obj);
        });
      };
    }),function(err,results) {
      callback(results);
    });
  };

  this.get_first_mac_address = function(callback){
    os_functions.get_first_mac_address(callback);
  };

  this.get_mac_address = function(nic_name,callback) {

    var e = new Error("Couldn't get valid MAC address for " + nic_name);
    
    os_functions.mac_address(nic_name,function(mac) {
      if (mac === null) {
        callback(e);
        return;
      }
      
      var mac_address_regexp = /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/i;
        
      if (mac_address_regexp.test(mac)) {
        callback(null,mac);
      } else {
        callback(e);
      }
      
    });

  };

};

//util.inherits(Hardware, Getters);
module.exports = new Hardware();
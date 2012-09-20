//////////////////////////////////////////
// Prey JS Hardware Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var
    common = Prey.common,
    util = require('util'),
    os = require('os'),
    exec = require('child_process').exec,
    os_functions = require('./platform/' + common.os_name),
    async = require("async"),
    err = Prey.err;

err.set('NO_MAC','No mac address');
err.set('MALFORMED_MAC','Malformed mac address');
err.set('NO_OSINTERFACE','os.networkInterface Api not supported');
err.set('NO_NICS','No (active) network interfaces found.');

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

    err.check('NO_OSINTERFACE',!os.networkInterfaces);

    var
      nics = os.networkInterfaces(),
      validNics = os_functions.validNics(Object.keys(nics)); // array of valid names

    err.check('NO_NICS',validNics === 0);

    async.parallel(validNics.map(function(name) {
      return function(ascb) {
        var ipv4nic = nics[name].filter(function(n) { return n.family === "IPv4"; });
        self.get_mac_address(name,function(mac) {
          var obj = {};
          obj.mac = mac;
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

    os_functions.mac_address(nic_name,function(mac) {

      err.check('NOMAC',!mac,nic_name);
      
      var mac_address_regexp = /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/i;

      err.check('MALFORMED_MAC',!mac_address_regexp.test(mac));

      callback(mac);
    
    });

  };

};

module.exports = new Hardware();
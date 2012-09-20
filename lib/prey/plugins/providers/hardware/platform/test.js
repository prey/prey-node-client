
Prey = require('../../../../../../lib');

console.log("OS:"+Prey.common.os_name);

var os=  require('./'+ Prey.common.os_name),
h = require("../../hardware"),
async = require("async"),
util = require('util');

var logger = Prey.common.logger;

Prey.err.setLogger(logger);

/*
w.mac_address("Local Area Connection",function(data) {
  console.log(data);
});
*/

var cs = os.getCacheStats();

var interfaces = function(cb) {
    console.log("INTERFACES");
    h.get_network_interfaces_list(function(list) {
      console.log(list);
      cb();
    });
};

var firmware = function(cb) {
    console.log("FIRMWARE");
    os.get_firmware_info(function(data) {
      console.log(data);
      cb();
    });
};

var cacheHits = function(cb) {
  h.get_network_interfaces_list(function(nics) {
    nics.map(function(n) {
      return n.name;
    }).forEach(function(name) {
      h.get_mac_address(name,function(mac) {
        console.log('mac '+mac+' hit for interface '+name);
        cb();
      });
    });
  });
};

var firstMac = function(cb) {
  h.get_first_mac_address(function(mac) {
    console.log('first mac = '+mac);
    cb();
  });
};

async.series([
  interfaces,
  firmware,
  cacheHits,
  firstMac,
  function() {
    console.log("FINISH UP");
    console.log(util.inspect(cs()));
  }  
]);
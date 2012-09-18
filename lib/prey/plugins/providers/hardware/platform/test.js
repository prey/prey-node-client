
Prey = require('../../../../../../lib');

console.log("PREY is "+Prey);

var w=require("./windows"),
h = require("../../hardware"),
async = require("async"),
util = require('util');

var logger = Prey.common.logger;

/*
w.mac_address("Local Area Connection",function(data) {
  console.log(data);
});
*/

var cs = w.getCacheStats();

var interfaces = function(cb) {
    console.log("INTERFACES");
    h.get_network_interfaces_list(function(list) {
      console.log(list);
      cb();
    });
};

var firmware = function(cb) {
    console.log("FIRMWARE");
    w.get_firmware_info(function(data) {
      console.log(data);
      cb();
    });
};

async.series([
  firmware,
  interfaces,
  function() {
    console.log("FINISH UP");
    console.log(util.inspect(cs()));
  }  
]);
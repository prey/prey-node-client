
Prey = require('../../../../../../lib');

console.log("PREY is "+Prey);

var w=require("./windows"),
h = require("../../hardware"),
async = require("async");

var logger = Prey.common.logger;

/*
w.mac_address("Local Area Connection",function(data) {
  console.log(data);
});
*/

var cs = w.getCacheStats();


async.series([
  function(cb1) {
    w.get_firmware_info(function(data) {
      console.log(data);
      cb1();
    });
  },
  function(cb2) {
    h.get_network_interfaces_list(function(list) {
      console.log(list);
      cb2();
    });
  },
  function() {
    console.log("HERE");
    console.log(JSON.stringify(cs()));
  }
  
]);
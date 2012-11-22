
require('../../../../../../lib');

console.log("OS:"+_ns("common").os_name);

var os=  require('./'+ _ns("common").os_name),
h = _ns("hardware"),
async = require("async"),
util = require('util');


/*
w.mac_address("Local Area Connection",function(data) {
  console.log(data);
});
*/

//var cs = os.getCacheStats();

var interfaces = function(cb) {
  console.log("INTERFACES");
  h.get_network_interfaces_list(function(err,list) {
    console.log(list);
    cb();
  });
};

var firmware = function(cb) {
  console.log("FIRMWARE");
  os.get_firmware_info(function(err,data) {
    console.log(data);
    cb();
  });
};

var cacheHits = function(cb) {
  h.get_network_interfaces_list(function(err,nics) {
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
  h.get_first_mac_address(function(err,mac) {
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
//    console.log(util.inspect(cs()));
  }  
]);

"use strict";

/*
  All public functions used cached data, cached values are not refreshed.
  Assumes global "Prey"
*/
  
var 
  wmic = require("./wmic"),
  async = require("async"),
  managedCache = Prey.utils.managedCache, 
  cache = managedCache.create();

var acquireInfo = function(type,callback) {
  var data = {};
  async.series(Object.keys(type).map(function(k) {
    return function(asyncCallback) {
      wmic.run(type[k],function(err,res) {
        if (!err) {
          var r = wmic.extractValue(res);
          data[k] = (r.length === 0) ? null : r ;
        } else {
          data[k] = null;
        }
         asyncCallback(null,data[k]);
      });
    };
  }),function() {
      callback(data);
  });
};

var baseBoardCmds = {
  mb_vendor:"baseboard get manufacturer",
  mb_serial:"baseboard get serialnumber",
  mb_model:"baseboard get product",
  mb_version:"baseboard get version",
	//uuid:"path win32_computersystemproduct get uuid"
};

var biosCmds = {
  bios_vendor:"bios get Manufacturer",
  bios_version:"bios get SMBIOSBIOSVersion"
};

exports.getCacheStats = function() {
  return managedCache.stats(cache);
};

cache.manage("nics",wmic.nicListFull);
cache.manage("bios",function(cb) {acquireInfo(biosCmds,cb); });
cache.manage("baseBoard",function(cb) { acquireInfo(baseBoardCmds,cb); });

var cachedFirmwareKeys = ["bios","baseBoard"];

// ---------------------- public ---------------------------

exports.validNics = function(nics) {
  return nics.filter(function(n) { return n !== "MS TCP Loopback interface" ; });
};

exports.mac_address = function(nic,cb){
  cache.value('nics',false,function(nics) {
    var namedNic = nics.filter(function(n) { return n.NetConnectionID === nic; });
    Prey.err.check('NOMAC',namedNic.length !== 1,nic);
    cb(namedNic[0].MACAddress);
  });
};

exports.get_first_mac_address = function(cb) {
  cache.value('nics',false,function(nics) {
    Prey.err.check('NOMAC',nics.length === 0);
    cb(nics[0].MACAddress);
  });
};

exports.get_firmware_info = function(callback){
  var firmware = {};
  async.series(cachedFirmwareKeys.map(function(type) {
    return function(cb) {
      cache.value(type,function(typeInfo) {
        Object.keys(typeInfo).forEach(function(k) {
          firmware[k] = typeInfo[k];          
        });
        cb(null,""); // return values assigned to firmware
      });
    };
  }),function() {
    callback(firmware);
  });
};

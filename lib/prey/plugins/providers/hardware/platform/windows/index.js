"use strict";

var 
  wmic = _ns("windows").wmic,
  async = require("async"),
  helpers = _ns('helpers');

var baseBoardCmds = {
  mb_vendor:"baseboard get manufacturer",
  mb_serial:"baseboard get serialnumber",
  mb_model:"baseboard get product",
  mb_version:"baseboard get version"
	//uuid:"path win32_computersystemproduct get uuid"
};

var biosCmds = {
  bios_vendor:"bios get Manufacturer",
  bios_version:"bios get SMBIOSBIOSVersion"
};

var cachedFirmwareKeys = {
  "bios":biosCmds,
  "baseBoard":baseBoardCmds
};

/*
  If a particular field returns an error then it's just marked as null rather than terminating
  the acquistion of other data. 
*/
var acquireInfo = function(type, callback) {
  var data = {};
  async.series(Object.keys(type).map(function(k) {
    return function(asyncCallback) {
      wmic.run(type[k],function(err,res) {
        if (err) { // don't callback err for this field, just mark it null
          data[k] = null;
          asyncCallback(null,data[k]);
          return;
        }
        var r = wmic.extractValue(res);
        data[k] = (r.length === 0) ? null : r ;
        asyncCallback(null,data[k]);
      });
    };
  }),function() {
    callback(null,data);
  });
} ;

/**
 * 
 **/
exports.get_firmware_info = function(callback) {
  var firmware = {};
  async.series(Object.keys(cachedFirmwareKeys).map(function(type) {
    return function(cb) {
      var t = cachedFirmwareKeys[type];
      acquireInfo(t,function(err,typeInfo) {
        Object.keys(typeInfo).forEach(function(k) {
          firmware[k] = typeInfo[k];          
        });
        cb(null,""); // return values assigned to firmware
      });
    };
  }),function() {
    callback(null,firmware);
  });
};

/**
 * TODO WMic the output of NetConnectionID in the machine locale, hence this needs reworked.
 **/
var validNics = exports.validNics = function(nics) {
  return nics.filter(function(n) { return n !== "MS TCP Loopback interface" ; });
};

/**
 * Callback an array of active nics or the empty array.  Memoized as the wmic
 * nic list full is slow.  There are no argument keys on this memoized function
 * so need to provide a dummy hasher, with key "key".
 **/
var getNics = helpers.memoize(function(callback) {
  wmic.nicListFull(function(err,nics) {
    if (err) return callback(_error(err));
    
    callback(null,nics.filter(function(n) {
      return n.NetConnectionStatus === "2" && n.NetConnectionID !== "MS TCP Loopback interface";
    }));
  });
            
},function() { return "key"; });

/**
 * Callsback an array of nic names. 
 **/
exports.get_active_nic_names  = function(callback) {
  getNics(function(err,nics) {
    if (err) return callback(_error(err));

    callback(nics.map(function(n) { return n.NetConnectionID; }));
  });
} ;

/**
 * Get a MAC address for a given nic name.
 **/
exports.mac_address = function(nic, callback) {
  getNics(function(err,nics) {
    if (err) return callback(_error(err));

    var namedNics = nics.filter(function(n) { return n.NetConnectionID === nic; });

    if (namedNics.length !== 1) {
      callback(_error("No nic",nic));
      return;
    }

    callback(null,namedNics[0].MACAddress);
  });
};

/**
 * ! TODO Change this appropriately.
 * System Key: [HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\[Adapter Name]\
 * Parameters\Tcpip]
 * Value Name: UseZeroBroadcast
 * Data Type: REG_DWORD (DWORD Value)
 * Value Data: (0 = default, 1 = use 0.0.0.0 broadcast)
 **/

exports.broadcast_address = function(nic_name, callback){
  callback(null,"255.255.255.255");
};


"use strict";

var async  = require('async'),
    common = require('./../../common'),
    system = common.system,
    wmic   = system.wmic;

var baseboard_cmds = {
  mb_vendor:  "baseboard get manufacturer",
  mb_serial:  "baseboard get serialnumber",
  mb_model:   "baseboard get product",
  mb_version: "baseboard get version"
	//uuid:"path win32_computersystemproduct get uuid"
};

var bios_cmds = {
  bios_vendor:  "bios get Manufacturer",
  bios_version: "bios get SMBIOSBIOSVersion"
};

var cachedFirmwareKeys = {
  "bios": bios_cmds,
  "baseBoard": baseboard_cmds
};

/**
 *
 **/
exports.get_firmware_info = function(callback) {
  var firmware = {};
  async.series(Object.keys(cachedFirmwareKeys).map(function(type) {
    return function(cb) {
      var t = cachedFirmwareKeys[type];
      acquireInfo(t, function(err,typeInfo) {
        Object.keys(typeInfo).forEach(function(k) {
          firmware[k] = typeInfo[k];
        });
        cb(null, ''); // return values assigned to firmware
      });
    };
  }),function() {
    callback(null, firmware);
  });
};

/**
 * TODO WMic the output of NetConnectionID in the machine locale, hence this needs reworked.
 **/
exports.valid_nics = function(nics) {
  return nics.filter(function(n) { return n !== "MS TCP Loopback interface"; });
};


/**
 * Get a MAC address for a given nic name.
 **/
exports.mac_address_for = function(nic, callback) {
  getNics(function(err, nics) {
    if (err) return callback(err);

    var namedNics = nics.filter(function(n) {
      return n.NetConnectionID === nic;
    });

    if (namedNics.length !== 1)
      return callback(new Error("NIC not found: " + nic));

    callback(null, namedNics[0].MACAddress);
  });
};

/////////////////////////////////////////////////////////////////
// helper functions
/////////////////////////////////////////////////////////////////

/*
  If a particular field returns an error then it's just marked as null rather than terminating
  the acquistion of other data.
*/
var acquireInfo = function(type, callback) {
  var data = {};
  async.series(Object.keys(type).map(function(k) {
    return function(asyncCallback) {
      wmic.run(type[k], function(err,res) {
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
};


/**
 * Callback an array of active nics or the empty array.  Memoized as the wmic
 * nic list full is slow.  There are no argument keys on this memoized function
 * so need to provide a dummy hasher, with key "key".
 **/
var getNics = async.memoize(function(callback) {
  wmic.list_full('nic',function(err,nics) {
    if (err) return callback(err);

    callback(null, nics.filter(function(n) {
      return n.NetConnectionStatus === "2" && n.NetConnectionID !== "MS TCP Loopback interface";
    }));
  });
});

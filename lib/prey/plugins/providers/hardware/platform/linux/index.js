
"use strict";

var
  exec = require('child_process').exec,
  async = require('async'),
  assert = require('assert'),
  managedCache = _ns("managedCache"),
  cache = managedCache.create();
  
var data_fields = {
  'system': {
    vendor_name: 'Manufacturer',
    model_name: 'Product Name',
    serial_number: 'Serial Number',
    uuid: 'UUID'
  },
  'baseboard': {
    mb_vendor: 'Manufacturer',
    mb_model: 'Product Name',
    mb_version: 'Version',
    mb_serial: 'Serial Number'
  },
  'chassis': {
    device_type: 'Type'
  },
  'bios': {
    bios_vendor: 'Vendor',
    bios_version: 'Version'
  }
};

var firmWare  = function (callback) {

  var get_value = function(output, string) {
    var regex = new RegExp(string + ": (.*)");
    var matches = output.toString().match(regex);
    if (matches) {
      return matches[1].trim() === '' ? null : matches[1];
    }
    return null;
  };

  var types = Object.keys(data_fields),
      data = {};

  async.parallel(types.map(function(type) {
    return function(acb) {
      exec('dmidecode -t ' + type, function(err, stdout) {
        if (err) return callback(_error('FIRMWARE',err));
        
        var fields = data_fields[type];
        Object.keys(fields).map(function(key) {
          var val = get_value(stdout, fields[key]);
          if (val) {
            data[key] = val.trim();
          }
        });
        
        acb(null,"");
      });
    };
  }),
  function(){
    callback(data);
  });
};

var mac_address_cmd = function(nic){
  return "ifconfig | grep " + nic + " | grep 'HWaddr' | awk '{print $5}'";
};

cache.manage('firmware',firmWare);

/*
  The cache key 'macs' is updated manually within the mac_address function, and hence uses
  cache.set
*/
var macs = {} ;
cache.manage('macs',function(cb) { cb(macs); });

// ---------------------- public ---------------------------

exports.validNics = function(nics) {
  return nics.filter(function(n) { return n !== "lo0" && n !== "lo" ; });
};

exports.get_active_nics = function(callback) {
  
};

exports.mac_address = function(nic_name,callback) {
  cache.value('macs',function(cachedMacs) {
    
    var value = cachedMacs[nic_name];
    if (value) {
      callback(null,value);
      return;
    }
    
    exec(mac_address_cmd(nic_name), function(err, stdout){
      if (err) return callback(_error('NO_MAC',err));

      var newValue = stdout.trim();
      cachedMacs[nic_name] = newValue;

      /*
        The cached value has been freshened here! So, cache.set let's cache know
        about this manual update of a composite object and keeps the cache stats
        in up to date.
      */
      cache.set('macs',cachedMacs);
      callback(null,newValue);
    });
  });
};

exports.get_first_mac_address = function(cb) {
  cache.value('macs',function(macs) {
    var keys = Object.keys(macs);
    cb(null,macs[keys[0]]);
  });
};

exports.get_firmware_info = function(callback){
  cache.value('firmware',function(data) {
    callback(null,data);
  });
};

/**
 * @param {String} nic_name  
 **/
exports.broadcast_address = function(nic_name, callback){
  var cmd = "ifconfig | grep " + nic_name + " -A1 | awk '/Bcast/ {print $3}'";
  exec(cmd, function(err, stdout){
    if(err) return callback(err);
    var output = stdout.toString();
    var broadcast = (output !== '') ? output.replace('Bcast:', '').split("\n")[0] : null;
    callback(null, broadcast);
  });
};


exports.getCacheStats = function() {
  return managedCache.stats(cache);
};

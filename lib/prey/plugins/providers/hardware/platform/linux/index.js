"use strict";

var
  exec = require('child_process').exec,
  async = require('async');
  
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
        if (err) return callback(_error("!:Firmware issue",err));
        
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
    callback(null,data);
  });
};

exports.validNics = function(nics) {
  return nics.filter(function(n) { return n !== "lo0" && n !== "lo" ; });
};

exports.get_active_nics = function(callback) {
  
};

exports.mac_address = function(nic_name,callback) {
  var cmd = "ifconfig | grep " + nic_name + " | grep 'HWaddr' | awk '{print $5}'";
  exec(cmd, function(err, stdout){
    if (err) return callback(_error("!:No mac",err));
    
    var newValue = stdout.trim();
    callback(null,newValue);
  });
};

exports.get_firmware_info = function(callback){
  firmWare(callback);
};

/**
 * @param {String} nic_name  
 **/
exports.broadcast_address = function(nic_name, callback){
  var cmd = "ifconfig | grep " + nic_name + " -A1 | awk '/Bcast/ {print $3}'";
  exec(cmd, function(err, stdout){
    if(err) return callback(_error("!:Can't get broadcast address",err));

    var output = stdout.toString();
    var broadcast = (output !== '') ? output.replace('Bcast:', '').split("\n")[0] : null;
    callback(null, broadcast);
  });
};


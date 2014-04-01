"use strict";

var wmic = require('wmic');

var firmware_keys = {
  uuid:          ['path win32_computersystemproduct', 'uuid'],
  serial_number: ['bios', 'serialnumber'],
  bios_vendor:   ['bios', 'Manufacturer'],
  bios_version:  ['bios', 'SMBIOSBIOSVersion'],
  mb_vendor:     ['baseboard', 'manufacturer'],
  mb_serial:     ['baseboard', 'serialnumber'],
  mb_model:      ['baseboard', 'product'],
  mb_version:    ['baseboard', 'version']
}

exports.get_firmware_info = function(callback) {

  var count = 0, data = {};

  var fetch = function(key, section, value){
    wmic.get_value(section, value, null, function(err, res){
      if (!err && res)
        data[key] = res;

      --count || callback(null, data)
    })
  }

  for (var key in firmware_keys) {
    count++;
    var values = firmware_keys[key];
    fetch(key, values[0], values[1]);
  }

};
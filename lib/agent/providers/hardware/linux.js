"use strict";

var exec  = require('child_process').exec,
    async = require('async'),
    sudo  = require('./../../common').system.sudo;

var data_fields = {
  system: {
    vendor_name: 'Manufacturer',
    model_name: 'Product Name',
    serial_number: 'Serial Number',
    uuid: 'UUID'
  },
  baseboard: {
    mb_vendor: 'Manufacturer',
    mb_model: 'Product Name',
    mb_version: 'Version',
    mb_serial: 'Serial Number'
  },
  chassis: {
    device_type: 'Type'
  },
  bios: {
    bios_vendor: 'Vendor',
    bios_version: 'Version'
  }
};

exports.get_firmware_info = function(callback) {

  var get_value = function(output, string) {
    var regex = new RegExp(string + ": (.*)");
    var matches = output.toString().match(regex);
    if (matches)
      return matches[1].trim() === '' ? null : matches[1];
  };

  var types = Object.keys(data_fields),
      data = {};

  async.parallel(types.map(function(type) {
    return function(done) {

      sudo('dmidecode', ['-t', type], function(err, stdout, stderr) {
        if (err) return done(err);

        var fields = data_fields[type];

        Object.keys(fields).map(function(key) {
          var val = get_value(stdout, fields[key]);
          if (val)
            data[key] = val.trim();
        });

        done();
      });
    };
  }),
  function(err){
    callback(err, data);
  });
};

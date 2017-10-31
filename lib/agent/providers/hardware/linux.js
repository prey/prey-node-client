"use strict";

var exec  = require('child_process').exec,
    async = require('async'),
    sudo  = require('sudoer');

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

var valid_types = ['Desktop', 'Laptop', 'Tablet'];

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
          if (val) {
            if (key == 'device_type' && valid_types.indexOf(val) == -1)
              val = 'Laptop';
            data[key] = val.trim();
          }
        });

        done();
      });
    };
  }),
  function(err){
    callback(err, data);
  });
};

exports.get_ram_module_list = function(cb) {

  var list = [];

  sudo('dmidecode', ['-t', 17], function(err, stdout) {
    if (err) return cb(err);

    stdout.toString().split('Memory Device').forEach(function(block) {

      if (block.match(/\tSize: \d/)) {

        var obj = {
          bank  : block.match(/Bank Locator: (.+)/)[1],
          type  : block.match(/Form Factor: (.+)/)[1],
          size  : parseInt(block.match(/Size: (.+)/)[1])      // in MBs
        }

        var speed_line = block.match(/Speed: (.+)/); 
        if (speed_line) 
          obj.speed = parseInt(speed_line[1]); // in MHz

        var width_line = block.match(/Data Width: (.+)/);
        if (width_line)
          obj.width = parseInt(width_line[1]); // in bits

        list.push(obj);
      }

    });

    cb(null, list);
  })
}

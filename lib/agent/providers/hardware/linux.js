"use strict";

var os = require('os'),
    exec = require('child_process').exec,
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

exports.mac_address_for = function(nic_name, callback) {
  var cmd = "ifconfig | grep " + nic_name + " | grep 'HWaddr' | awk '{print $5}'";
  exec(cmd, callback);
};

exports.interface_type_for = function(nic_name, cb){
  exec('cat /proc/net/wireless | grep ' + nic_name, function(err, out){
    return cb(null, err ? 'Wired' : 'Wireless')
  })
}

exports.get_network_interfaces = function(cb){

  var count = 0,
      list = [],
      nics = os.networkInterfaces();

  var append_data = function(obj) {
    exports.mac_address_for(obj.name, function(err, res){
      if (!err && res)
        obj.mac_address = res.trim();

      exports.interface_type_for(obj.name, function(err, res){
        if (!err && res)
          obj.type = res;

        list.push(obj);
        --count || cb(null, list);
      })
    })
  }

  for (var key in nics) {

    if (key != 'lo0' && key != 'lo') {

      count++;
      var obj = { name: key };

      nics[key].forEach(function(type){
        if (type.family == 'IPv4'){
          obj.ip_address = type.address;
        }
      });

      append_data(obj);
    }

  }
}

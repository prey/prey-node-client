"use strict";

var os = require('os'),
    common = require('./../../common'),
    wmic   = common.system.wmic;

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

/**
 *
 **/
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

/**
 * Get a MAC address for a given nic name.
 **/
exports.mac_address_for = function(nic_name, cb){
  var cond = 'NetConnectionID = \'' + nic_name + '\'';
  wmic.get_value('nic', 'MACAddress', cond, cb);
}

exports.get_network_interfaces = function(callback) {

  var list = [],
      node_nics = os.networkInterfaces();

  wmic.list_full('nic', function(err, nics) {
    if (err) return callback(err);

    nics.forEach(function(nic){
      if (nic.NetConnectionID != '' && nic.MACAddress != '') {

        var obj = {
          name: nic.NetConnectionID,
          // description: nic.Name,
          mac_address: nic.MACAddress,
          ip_address: nic.IPAddress,
          vendor: nic.Manufacturer,
          model: nic.Description,
          type: nic.Name.match(/wi-?fi|wireless/i) ? 'Wireless' : 'Wired'
        }

        var node_nic = node_nics[obj.name] || [];

        node_nic.forEach(function(type){
          if (type.family == 'IPv4') {
            obj.ip_address = type.address;
          }
        });

        list.push(obj);
      }
    })

    callback(null, list);
  });

};

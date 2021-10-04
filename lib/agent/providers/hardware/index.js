//////////////////////////////////////////
// Prey JS Hardware Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

"use strict";

var _       = require('underscore'),
    os      = require('os'),
    async   = require('async'),
    network = require('network'),
    hooks   = require('./../../hooks'),
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    device_keys  = require('./../../utils/keys-storage'),
    os_functions = require('./' + os_name),
    exp     = module.exports;

exp.get_processor_info = function(callback) {
  var cpus = os.cpus();
  var cpu_info = {
    model: cpus[0].model.trim(),
    speed: cpus[0].speed,
    cores: cpus.length
  };
  callback(null, cpu_info);
};

/**
 * There are no parameters to create a memoized hash key on so supply "key" as default in
 * optional hasher function.
 **/
exp.get_firmware_info = async.memoize(function(callback){
  os_functions.get_firmware_info(function(err, data) {
    if (err) return callback(err);

    if (data.device_type)
      data.device_type = data.device_type.replace('Notebook', 'Laptop');

    callback(null, data);
  });
});

exp.get_storage_devices_list = function(callback){
  callback(new Error('TODO!'))
};


/**
 * Returns full list of network interfaces, including MAC and broadcast address
 **/

exp.get_network_interfaces_list = network.get_interfaces_list;
exp.get_tpm_module = os_functions.get_tpm_module;
exp.get_os_edition = os_functions.get_os_edition;
exp.get_winsvc_version = os_functions.get_winsvc_version;

// even though these functions look like they belong in the network provider,
// we put them here because MAC addresses are part of the network interfaces,
// and are not subject to change (even though they can be spoofed)

exp.get_first_mac_address = function(callback) {

  network.get_interfaces_list(function(err, list) {
    if (err)
      callback(err)
    else if (list && list[0] && list[0].mac_address)
      callback(null, list[0].mac_address);
    else
      callback(new Error("Couldn't find any valid MAC addresses!"));
  });

};

exp.get_ram_module_list = os_functions.get_ram_module_list;

exp.track_hardware_changes = (data) => {
  if (data.tpm_module) delete data.tpm_module;
  if (data.os_edition) delete data.os_edition;
  if (data.winsvc_version) delete data.winsvc_version;

  var diff_count = 0;
  var save_data = () => {
    device_keys.store('hardware', data, (err) => {
      if (err) logger.error('Unable to save hardware data');
    });
  }

  var compare_field = (current, stored) => {
    if (stored instanceof Array) {
      if (!current || (current.length > stored.length)) return diff_count++;
      stored.forEach((value) => {
        if (_.findIndex(current, value) == -1) {
          return diff_count++;
        }
      })
    } else if (stored instanceof Object) {
      if (!current || (Object.keys(current).length > Object.keys(stored).length)) return diff_count++;
      Object.keys(stored).forEach((key) => {
        compare_field(current[key], stored[key])
      });
    } else {
      if (current != stored) diff_count++;
    }
  }

  device_keys.exist('hardware', (err, stored_data) => {
    if (err) logger.error('Unable to read hardware data');
    if (!stored_data) return save_data();

    stored_data = stored_data[0];
    compare_field(data, stored_data);

    if (diff_count > 0) {
      hooks.trigger('hardware_changed');

      device_keys.del('hardware', (err) => {
        if (err) logger.error('Unable to delete hardware data');
        save_data();
      })
    }
  })
}

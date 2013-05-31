//////////////////////////////////////////
// Prey JS Hardware Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

"use strict";

var
 os      = require('os'),
 async   = require('async'),
 os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
 os_functions = require('./' + os_name),
 exp = module.exports;

exports.mac_address_regex = /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/i;

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
 * There are no parameters to create a memoized hash key on so supply "key" as default in
 * optional hasher function.
 * Returns full list of network interfaces, including MAC and broadcast address
 **/
exp.get_network_interfaces_list = async.memoize(function(cb) {

  if (!os.networkInterfaces)
    return cb(new Error('os.networkInterfaces not found. Please update Node.'))

  os_functions.get_network_interfaces(function(err, nics){
    if (err || !nics || nics.length === 0)
      return cb(new Error('No valid network interfaces detected.'));

    cb(null, nics);
  });

});

// even though these functions look like they belong in the network provider,
// we put them here because MAC addresses are part of the network interfaces,
// and are not subject to change (even though they can be spoofed)

exp.get_first_mac_address = function(callback){

	exp.get_network_interfaces_list(function(err, list){

		if (err)
			callback(err)
		else if (list && list[0] && list[0].mac_address)
			callback(null, list[0].mac_address);
		else
			callback(new Error("Couldn't find any valid MAC addresses!"));

	});

};

/**
 * Wrapper around OS mac_address for that checks against regex for validity.
 **/

exp.mac_address_for = async.memoize(function(nic_name, callback) {

  os_functions.mac_address_for(nic_name, function(err, out) {
    if (err || !out)
      return callback(err || new Error("Couldn't find MAC for " + nic_name));

    var mac = out.trim();

    if (!exports.mac_address_regex.test(mac))
      return callback(new Error('Malformed mac: ' + mac));

    callback(null, mac);
  });

});

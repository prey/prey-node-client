//////////////////////////////////////////
// Prey JS Hardware Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		util = require('util'),
		os = require('os'),
		exec = require('child_process').exec,
		os_functions = require('./platform/' + common.os_name),
Getters = require('./../../../getters'),
lang = require("./../../../lang");

var Hardware = function(){

	Getters.call(this);
	var self = this;
	// this.name = 'hardware';

	this.getters = [
		'first_mac_address',
		'processor_info',
		'firmware_info',
		'network_interfaces_list'
	];

	this.get_processor_info = function(callback){

		var cpus = os.cpus();

		var cpu_info = {
			model: cpus[0].model,
			speed: cpus[0].speed,
			cores: cpus.length
		}

		callback(null, cpu_info);

	};

	this.get_firmware_info = function(callback){

		os_functions.get_firmware_info(function(err, data){

			if(!data || Object.keys(data) == 0)
				callback(err)
			else
				callback(null, data);

		});

	};


  this.other_get_network_interfaces_list = function(callback) {
	// old versions of node don't have this method
		if(!os.networkInterfaces)
			return callback(new Error("os.networkInterfaces not found!"));

		var list = [];
		var nics = os.networkInterfaces();
		var pending_nics = 0;
    var key;

		if (Object.keys(nics).length == 1 && (nics['lo0'] || nics['lo'])){
			return callback(new Error("No (active) network interfaces found."))
		}
    
    
    for (key in nics) {
      if (nics.hasOwnProperty(key)) {
        
			  if (key == 'lo' || key == 'lo0') continue;

			  var nic = nics[key];
			  var object = { name: key }
        
			  nic.forEach(function(type){
				  if(type.family == 'IPv4'){
					  object.ip_address = type.address
				  }
			  });
        
			  list.push(object);
			  //append_mac_address(object);
			  pending_nics++;
        
		  }
    }
    
    callback(list);
  };
  
	this.get_network_interfaces_list = function(callback){

		// old versions of node don't have this method
		if(!os.networkInterfaces)
			return callback(new Error("os.networkInterfaces not found!"));

		// var list = {};
		var list = [];
		var nics = os.networkInterfaces();
		var pending_nics = 0;
    var key;
    

		if (Object.keys(nics).length == 1 && (nics['lo0'] || nics['lo'])){
			return callback(new Error("No (active) network interfaces found."))
		}

		var append_mac_address = function(object){

			self.get('mac_address', object.name, function(err, mac){
				if (!err) object.mac_address = mac;
				--pending_nics || callback(null, list);
			});

		}

		for (key in nics) {

			if (key == 'lo' || key == 'lo0') continue;

			var nic = nics[key];
			var object = { name: key }

			nic.forEach(function(type){
				if(type.family == 'IPv4'){
					object.ip_address = type.address
				}
			});

			list.push(object);
			append_mac_address(object);
			pending_nics++;

		}

    callback(list);

	};

	this.get_first_mac_address = function(callback){

		this.get('network_interfaces_list', function(err, list){

			if (err)
				callback(err)
			else if (list && list[0])
				callback(null, list[0].mac_address);
			else
				callback(new Error("Couldn't get any MAC addresses!"));

		});

	};

  this.get_mac_address = function(nic_name,callback) {

    var e = new Error("Couldn't get valid MAC address for " + nic_name);
    
    os_functions.mac_address(nic_name,function(mac) {
      if (mac == null) {
        callback(e);
        return;
      }
      
      var mac_address_regexp = /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/i;
        
			if (mac_address_regexp.test(mac)) {
				callback(null,mac);
			} else {
				callback(e);
      }
      
    });

  };


/*
  this.get_mac_address = function(nic_name, callback){

		exec(os_functions.mac_address_cmd(nic_name), function(err, stdout, stderr){

			if (err) return callback(err);

			var output = stdout.toString().split("\n")[0];
			var mac_address_regexp = /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/i;

			if (mac_address_regexp.test(output))
				callback(null, output);
			else
				callback(new Error("Couldn't get valid MAC address for " + nic_name));

		});

	};

  */

};

util.inherits(Hardware, Getters);
module.exports = new Hardware();

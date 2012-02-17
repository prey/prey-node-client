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
		Provider = require('./../../../provider'),
		os_functions = require('./platform/' + common.os_name);

var Hardware = function(){

	Provider.call(this);
	var self = this;
	// this.name = 'hardware';

	this.getters = [
		'cpu_info',
		'firmware_info',
		'network_interfaces_list'
	];

	this.get_cpu_info = function(){

		var cpus = os.cpus();

		var cpu_info = {
			model: cpus[0].model,
			speed: cpus[0].speed,
			cores: cpus.length
		}

		this.emit('cpu_info', null, cpu_info);

	};

	this.get_firmware_info = function(){

		os_functions.get_firmware_info(function(data){
			if(!data || Object.keys(data) == 0)
				self.emit('firmware_info', new Error("Coulnd't get any firmware data."))
			else 
				self.emit('firmware_info', null, data);
		});

	};

	this.get_mac_address = function(nic_name){

		exec(os_functions.mac_address_cmd(nic_name), function(err, stdout, stderr){

			if(err) return self.emit('mac_address', e);

			var output = stdout.toString().split("\n")[0];
			var mac_address_regexp = /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/i;
			
			if(mac_address_regexp.test(output))
				self.emit('mac_address', null, output);
			else
				self.emit('mac_address', new Error("Couldn't get MAC address for " + nic_name));

		});

	};

	this.get_network_interfaces_list = function(){

		// old versions of node don't have this method
		if(!os.networkInterfaces) 
			return this.emit('network_interfaces', new Error("os.networkInterfaces method not found!"));

		// var list = {};
		var list = [];
		var nics = os.networkInterfaces();
		var pending_nics = 0;

		for(key in nics){

			if(key == 'lo' || key == 'lo0') continue;

			var nic = nics[key];
			// console.log(nic);

			var object = {
				name: key
			}

			nic.forEach(function(type){
				if(type.family == 'IPv4'){
					object.ip_address = type.address
				}
			})

			this.get('mac_address', key, function(mac){
				object.mac_address = mac;
				list.push(object);
				--pending_nics || self.emit('network_interfaces_list', null, list);
			});
			
			pending_nics++;

		}

	};

};

util.inherits(Hardware, Provider);
module.exports = new Hardware();

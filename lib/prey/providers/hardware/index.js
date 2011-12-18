//////////////////////////////////////////
// Prey JS Hardware Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../common'),
		util = require('util'),
		os = require('os'),
		Provider = require('../../provider'),
		os_functions = require('./platform/' + common.os_name);

var Hardware = function(){

	Provider.call(this);
	var self = this;
	this.name = 'hardware';

	this.getters = [
		'cpu_info',
		'network_interfaces_list',
		'firmware_info'
	];

	this.get_cpu_info = function(){

		var cpus = os.cpus();

		var cpu_info = {
			model: cpus[0].model,
			speed: cpus[0].speed,
			cores: cpus.length
		}

		this.emit('cpu_info', cpu_info);

	};

	this.get_firmware_info = function(){

		os_functions.get_firmware_info(function(data){
			self.emit('firmware_info', data);
		});

	};

	this.get_network_interfaces_list = function(){

		// old versions of node don't have this method
		if(!os.networkInterfaces) return this.emit('network_interfaces', null);

		// var list = {};
		var list = [];
		var nics = os.networkInterfaces();

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

			// network_interfaces[key] = object;
			list.push(object);

		}

		this.emit('network_interfaces_list', list);

	};

};

util.inherits(Hardware, Provider);
module.exports = new Hardware();

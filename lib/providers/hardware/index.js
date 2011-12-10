//////////////////////////////////////////
// Prey JS Hardware Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		os = require('os'),
		Provider = require('../../provider');

var Hardware = function(){

	Provider.call(this);
	var self = this;
	this.name = 'hardware';

	this.getters = [
		'cpu_info',
		'network_interfaces_list'
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

	this.get_network_interfaces_list = function(){

		var network_interfaces = {};
		var nics = os.networkInterfaces();

		for(key in nics){

			if(key == 'lo') continue;

			var nic = nics[key];
			// console.log(nic);

			var hash = {
				name: key,
				ip_address: nic[0].address,
				mac_address: nic[1].address
			}

			network_interfaces[key] = hash;

		}

		this.emit('network_interfaces_list', network_interfaces);

	};

};

util.inherits(Hardware, Provider);
module.exports = new Hardware();

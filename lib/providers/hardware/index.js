//////////////////////////////////////////
// Prey JS Hardware Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		os = require('os'),
		Command = require('command'),
		InfoModule = require('../../info_module');

var Hardware = function(){

	InfoModule.call(this);
	var self = this;
	this.name = 'hardware';

	this.data = {};

	this.get_cpu_info = function(){

		var cpus = os.cpus();

		var cpu_info = {
			model: cpus[0].model,
			speed: cpus[0].speed,
			cores: cpus.length
		}

		this.data.cpu_info = cpu_info;

	};

	this.get_network_interfaces = function(){

		this.data.network_interfaces = {};
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

			this.data.network_interfaces[key] = hash;

		}

	};

};

util.inherits(Hardware, InfoModule);
module.exports = new Hardware();

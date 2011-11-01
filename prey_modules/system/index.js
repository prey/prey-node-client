//////////////////////////////////////////
// Prey JS System Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		os = require('os'),
		Command = require('../../lib/command'),
		ActionModule = require('../../core/action_module');

var System = function(){

	ActionModule.call(this);
	var self = this;
	this.name = 'system';

	this.data = {};

	this.start = function(){

		console.log(' -- Getting system information...');
		this.get_cpu_info();
		this.get_network_interfaces();

		// console.log(this.data);

		this.done();

	}

	this.stop = function(){
		this.done();
	}

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
		var nics = os.getNetworkInterfaces();

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

sys.inherits(System, ActionModule);
module.exports = new System();

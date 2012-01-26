//////////////////////////////////////////
// Prey JS Network Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('../../common'),
		util = require('util'),
		emitter = require('events').EventEmitter,
		os = require('os'),
		http = require('http'),
		exec = require('child_process').exec,
		Provider = require('./../../provider'),
		Hardware = require('./../hardware'),
		os_functions = require('./platform/' + common.os_name);

var Network = function(){

	Provider.call(this);
	var self = this;
	this.name = 'network';

	this.getters = [
		'public_ip',
		'private_ip',
		'first_mac_address',
		'active_network_interface',
		'access_points_list',
		'active_access_point'
	];

	this.is_ip_address = function(str){
		var regexp = /^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})$/;
		return regexp.test(str);
	}

	this.get_public_ip = function(){

		var regex = /Current IP Address: (\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/;
		var host = 'checkip.dyndns.org';

		var req = http.get({ host: host, path: '/'}, function(res) {

				var html = '';

				res.on('data', function(chunk) {
					html += chunk;
				});

				res.on('end', function() {
					var ip = html.match(regex)[1];
					self.emit('public_ip', ip);
				});

		});
		
		req.on('error', function(err){
			return this.emit('public_ip', null, err.code);
		})
		
	};

	this.get_private_ip = function(){

		Hardware.get('network_interfaces_list', function(list){

			list.forEach(function(nic){
				if(self.is_ip_address(nic.ip_address))
					return self.emit('private_ip', nic.ip_address);
			})

			return self.emit('private_ip', null);

		});

	};

	this.get_broadcast_address = function(nic_name){

		exec(os_functions.broadcast_address_cmd(nic_name), function(err, stdout, stderr){

			if(err) return self.emit('broadcast_address', false, err.code);

			var output = stdout.toString();
			var broadcast = (output != '') ? output.replace('Bcast:', '').split("\n")[0] : null;
			self.emit('broadcast_address', broadcast);

		});

	};

	this.get_first_mac_address = function(){

		Hardware.get('network_interfaces_list', function(list){

			if(list[0])
				self.emit('first_mac_address', list[0].mac_address);
			else
				self.emit('first_mac_address', null, "Couldn't get any MAC addresses!");

		});

	};

/*

	this.get_mac_addresses_list = function(){

		var macs = [];

		Hardware.get('network_interfaces_list', function(list){
			
			if(!list)
				return self.emit('first_mac_address', null, "Couldn't get any MAC addresses!");
			
			list.forEach(function(nic){
				if(nic.mac_address) macs.push(nic.mac_address);
			})
			
			self.emit('mac_addresses_list', macs);

		});

	};

*/

	this.get_active_access_point = function(){

		exec(os_functions.active_access_point_cmd, function(err, stdout, stderr){

			if(err) return self.emit('active_access_point', false, err.code);
			self.emit('active_access_point', stdout.toString() == '' ? null : stdout.toString().trim());

		});

	};

	this.get_access_points_list = function(){

		this.get('first_wireless_device', function(wifi_device_name){

			// var val = 'wlan0';

			if(!wifi_device_name)
				return self.emit('access_points_list', false, "Wifi device required for access points list.");

			os_functions.get_access_points_list(wifi_device_name, function(result){

				if(!result)
					return self.emit('access_points_list', false, "Failed to get a list of nearby nearby wifi hotspots.");
				else if(result.length && result.length > 0)
					return self.emit('access_points_list', result);

				try {
					var json_list = JSON.parse(result);
					return self.emit('access_points_list', json_list);
				} catch(e) {
					return self.emit('access_points_list', false, "Wifi hotspots list was returned in invalid format.");
				}

			});

		});

	}
	
	this.get_nic_by_name = function(name) {
		Hardware.get('network_interfaces_list', function(list){
			
			if(!list) return self.emit('nic_by_name', null, "Couldn't get NIC list.")
			
			list.forEach(function(nic){
				if(nic.name == name) return self.emit('nic_by_name', nic);
			})
			
			self.emit('nic_by_name', null, "Couldn't find NIC named " + name);
			
		})
	}

	this.get_active_network_interface = function(){

		// works for Linux and Mac (at least on Lion)
		var cmd = "netstat -rn | grep UG | awk '{print $NF}'";

		exec(cmd, function(err, stdout, stderr){

			if(err) return self.emit('active_network_interface', null, err.code);

			var nic_name = stdout.toString().trim().split('\n');
			
			if(nic_name.length == 0 || nic_name == ['']){

				self.emit('active_network_interface', null, "Couldn't find an active network interface.");
				
			} else {

				self.get('nic_by_name', nic_name, function(nic){
					self.get('broadcast_address', nic_name, function(bc_address){
						nic.broadcast_address = bc_address;
						self.emit('active_network_interface', nic)
					})
				})
				
			}

		});

	};

	this.get_first_wireless_device = function(){

		this.get('wireless_devices_list', function(list){

			if(list[0])
				self.emit('first_wireless_device', list[0]);
			else
				self.emit('first_wireless_device', false, 'No wifi devices found.');

		});

	};

	this.get_wireless_devices_list = function(){

		exec(os_functions.wireless_devices_list_cmd, function(err, stdout, stderr){

			if(err) return self.emit('wireless_devices_list', false, e.message);
			
			var list = stdout.toString().trim().split('\n');
			self.emit('wireless_devices_list', list);

		});

	};

};

util.inherits(Network, Provider);
module.exports = new Network();

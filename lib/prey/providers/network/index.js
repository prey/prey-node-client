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
		'mac_addresses_list',
		'access_points_list',
		'active_access_point'
	];

//	this.run = function(){
//		this.get_public_ip();
//		this.get_private_ip();
//		this.get_mac_address();
//		this.get_access_points_list();
//	};

	this.is_ip_address = function(str){
		var regexp = /^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})$/;
		return regexp.test(str);
	}

	this.get_public_ip = function(){

		var regex = /Current IP Address: (\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/;
		var host = 'checkip.dyndns.org';

		http.get({ host: host, path: '/'}, function(res) {

				var html = '';

				res.on('data', function(chunk) {
					html += chunk;
				});

				res.on('end', function() {
					var ip = html.match(regex)[1];
					self.emit('public_ip', ip);
				});

		});

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

	this.get_ip_address = function(nic_name){

		var nics = this.nics || os.networkInterfaces();
		self.emit('ip_address', nics[nic_name][0].address);

	};

	this.get_broadcast_address = function(nic_name){

		exec(os_functions.broadcast_address_cmd(nic_name), function(err, stdout, stderr){

			if(err) return self.emit('broadcast_address', false, e.code);

			var output = stdout.toString();
			var broadcast = (output != '') ? output.replace('Bcast:', '').split("\n")[0] : null;
			self.emit('broadcast_address', broadcast);

		});

	};

	this.get_mac_address = function(nic_name){

		exec(os_functions.mac_address_cmd(nic_name), function(err, stdout, stderr){

			if(err) return self.emit('mac_address', false, e.code);

			var output = stdout.toString();
			var mac = (output != '') ? output.split("\n")[0] : null;
			self.emit('mac_address', mac);

		});

	};

	this.get_first_mac_address = function(){

		this.get('mac_addresses_list', function(list){

			var first_mac_address = list[0];
			self.emit('first_mac_address', first_mac_address);

		});

	};

	this.get_mac_addresses_list = function(){

		exec(os_functions.mac_addresses_list_cmd, function(err, stdout, stderr){

			if(err) return self.emit('mac_addresses_list', false, e.code);
			self.emit('mac_addresses_list', stdout.toString().trim().split("\n"));

		});

	};

	this.get_active_access_point = function(){

		exec(os_functions.active_access_point_cmd, function(err, stdout, stderr){

			if(err) return self.emit('active_access_point', false, e.code);
			self.emit('active_access_point', stdout.toString());

		});

	};

	this.get_access_points_list = function(){

		this.get('first_wireless_device', function(val){

			// var val = 'wlan0';

			if(!val) {
				self.emit('access_points_list', false, "Wifi device required for access points list.");
				return false;
			}

			var wifi_device_name = val;
			os_functions.get_access_points_list(wifi_device_name, function(result){

				if(!result) {
					self.emit('access_points_list', false, "Failed to get a list of nearby nearby wifi hotspots.");
					return false;
				}

				try {
					var json_list = JSON.parse(result);
					self.emit('access_points_list', json_list);
				} catch(e) {
					self.emit('access_points_list', false, "Wifi hotspots list was returned in invalid format.");
					return false;
				}

			});

		});

	}

	this.get_active_network_interface = function(){

		// this is only for linux, actually
		var str = "netstat -rn | grep UG | awk '{print $NF}'";

		exec(cmd, function(err, stdout, stderr){

			if(err) return self.emit('active_network_interface', false);

			var parsed = stdout.toString().trim().split('\n');
			if(parsed.length == 0 || parsed == [''])
				self.emit('active_network_interface', false);
			else
				get_mac_and_ip(parsed[0]);

		});

		function get_mac_and_ip(nic){

			self.get('mac_address', nic, function(mac){

				self.get('ip_address', nic, function(ip){

					self.get('broadcast_address', nic, function(broadcast){

						var data = {
							name: nic,
							ip_address: ip,
							mac_address: mac,
							broadcast_address: broadcast
						}

						self.emit('active_network_interface', data);

					});

				});

			});

		};

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

			if(err) return self.emit('first_wireless_device', false, e.message);

			self.emit('wireless_devices_list', stdout.toString().trim().split('\n'));

		});

	};

};

util.inherits(Network, Provider);
module.exports = new Network();

//////////////////////////////////////////
// Prey JS Network Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		util = require('util'),
		emitter = require('events').EventEmitter,
		os = require('os'),
		http = require('http'),
		exec = require('child_process').exec,
		Provider = require('./../../../provider'),
		Hardware = require('./../hardware'),
		os_functions = require('./platform/' + common.os_name);

var Network = function(){

	Provider.call(this);
	var self = this;
	// this.name = 'network';

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

		var req = http.get({host: host, path: '/'}, function(res){

				var html = '';

				res.on('data', function(chunk) {
					html += chunk;
				});

				res.on('end', function() {
					var ip = html.match(regex)[1];
					self.emit('public_ip', null, ip);
				});

		});
		
		req.on('error', function(err){
			return this.emit('public_ip', err);
		})
		
	};

	this.get_private_ip = function(){

		Hardware.get('network_interfaces_list', function(err, list){

			list.forEach(function(nic){
				if(self.is_ip_address(nic.ip_address))
					return self.emit('private_ip', null, nic.ip_address);
			})

			return self.emit('private_ip', new Error("No private IP found in any of the " + list.length + " interfaces."));

		});

	};

	this.get_broadcast_address = function(nic_name){

		exec(os_functions.broadcast_address_cmd(nic_name), function(err, stdout, stderr){

			if(err) return self.emit('broadcast_address', err);

			var output = stdout.toString();
			var broadcast = (output != '') ? output.replace('Bcast:', '').split("\n")[0] : null;
			self.emit('broadcast_address', null, broadcast);

		});

	};

	this.get_first_mac_address = function(){

		Hardware.get('network_interfaces_list', function(err, list){

			if(list[0])
				self.emit('first_mac_address', null, list[0].mac_address);
			else
				self.emit('first_mac_address', new Error("Couldn't get any MAC addresses!"));

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
	
	this.get_nic_by_name = function(name) {

		Hardware.get('network_interfaces_list', function(err, list){
			
			if(!list) return self.emit('nic_by_name', err);
			
			list.forEach(function(nic){
				if(nic.name == name) return self.emit('nic_by_name', null, nic);
			})
			
			self.emit('nic_by_name', new Error("Couldn't find NIC named " + name));
			
		})
	}

	this.get_active_network_interface = function(){

		// works for Linux and Mac (at least on Lion)
		var cmd = "netstat -rn | grep UG | awk '{print $NF}'";

		exec(cmd, function(err, stdout, stderr){

			if(err) return self.emit('active_network_interface', err);

			var nic_name = stdout.toString().trim().split('\n');
			
			if(nic_name.length == 0 || nic_name == ['']){

				self.emit('active_network_interface', new Error("Couldn't find an active network interface."));
				
			} else {

				self.get('nic_by_name', nic_name, function(err, nic){
					self.get('broadcast_address', nic_name, function(err, bc_address){
						nic.broadcast_address = bc_address;
						self.emit('active_network_interface', null, nic)
					})
				})
				
			}

		});

	};

	this.get_first_wireless_interface = function(){

		this.get('wireless_interface_names', function(err, list){

			if(list && list[0])
				self.emit('first_wireless_interface', null, list[0]);
			else
				self.emit('first_wireless_interface', new Error('No wifi network interfaces found.'));

		});

	};

	// returns array of names of wireless interfaces 
	this.get_wireless_interface_names = function(){

		exec(os_functions.wireless_devices_list_cmd, function(err, stdout, stderr){

			if(err) return self.emit('wireless_interface_names', err);
			
			var list = stdout.toString().trim().split('\n');
			self.emit('wireless_interface_names', null, list);

		});

	};

	this.get_active_access_point = function(){

		exec(os_functions.active_access_point_cmd, function(err, stdout, stderr){

			if(err) return self.emit('active_access_point', err);
			
			if(stdout.toString() == '')
				self.emit('active_access_point', new Error("No active access point found"));
			else
				self.emit('active_access_point', null, stdout.toString().trim());

		});

	};

	this.get_access_points_list = function(){

		this.get('first_wireless_interface', function(err, wifi_nic_name){

			if(err) return callback(err);

			os_functions.get_access_points_list(wifi_nic_name, function(err, result){

				if(err)
					return self.emit('access_points_list', err);
				else if(result instanceof Object)
					return self.emit('access_points_list', null, result);

				// this is in case the list is JSON.stringified
				try {
					self.emit('access_points_list', null, JSON.parse(result));
				} catch(e) {
					console.log(e);
					self.emit('access_points_list', new Error("Wifi hotspots list was returned in invalid format."));
				}

			});

		});

	}

	this.get_open_access_points_list = function(){
		
		this.get('access_points_list', function(err, list){

			if(err) return self.emit('open_access_points_list', err);
			var open_aps = [];

			list.forEach(function(ap){
				if(ap.security == 'NONE')
					open_aps.push(ap);
			})

			if(open_aps.length == 0)
				return self.emit('open_access_points_list', new Error("No open access points found. Try moving around a bit."))

			// sort them from the nearest to the farthest
			open_aps.sort(function(a, b){ 
				return a.signal_strength > b.signal_strength; 
				// return parseInt(a.signal_strength) > parseInt(b.signal_strength) 
			});
			
			self.emit('open_access_points_list', null, open_aps);

		})
		
	}


};

util.inherits(Network, Provider);
module.exports = new Network();

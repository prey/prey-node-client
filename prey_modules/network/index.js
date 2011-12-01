//////////////////////////////////////////
// Prey JS Network Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('../../core/base'),
		util = require('util'),
		emitter = require('events').EventEmitter,
		os = require('os'),
		http = require('http'),
		Command = require('../../lib/command'),
		ReportModule = require('../../core/report_module'),
		os_functions = require('./platform/' + base.os_name);

var Network = function(){

	ReportModule.call(this);
	var self = this;
	this.name = 'network';

	this.trace_methods = [
		'public_ip',
		'private_ip',
		'first_mac_address',
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

		var nics = this.nics || os.networkInterfaces();

		for(name in nics){

			var nic = nics[name];
			var addr = nic[0].address;

			if(name != 'lo' && self.is_ip_address(addr)){
				return self.emit('private_ip', addr);
			}

		};

	};

	this.get_ip_address = function(nic_name){

		var nics = this.nics || os.networkInterfaces();
		self.emit('ip_address', nics[nic_name][0].address);

	};

	this.get_mac_address = function(nic_name){

		var cmd = new Command(os_functions.mac_address_cmd(nic_name));

		cmd.on('error', function(e){
			self.emit('mac_address', false, e.code);
		});

		cmd.on('return', function(output){
			var mac = (output != '') ? output.split("\n")[0] : null;
			self.emit('mac_address', mac);
		});

	};

	this.get_first_mac_address = function(){
		this.get('mac_addresses_list', function(list){

			var first_mac_address = list.split("\n")[0];
			self.emit('first_mac_address', first_mac_address);
		});

	};

	this.get_mac_addresses_list = function(){

		var cmd = new Command(os_functions.mac_addresses_list_cmd);

		cmd.on('error', function(e){
			self.emit('mac_addresses_list', false, e.code);
		});

		cmd.on('return', function(output){
			self.emit('mac_addresses_list', output);
		});

	};

	this.get_active_access_point = function(){

		var cmd = new Command(os_functions.active_access_point_cmd);

		cmd.on('error', function(e){
			self.emit('active_access_point', false, e.message);
		});

		cmd.on('return', function(output){
			self.emit('active_access_point', output);
		});

	};

	this.get_access_points_list = function(){

		this.get('first_wireless_device', function(val){

			var val = 'wlan0';

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

		var cmd = new Command(str);
		cmd.on('error', function(e){
			self.emit('active_network_interface', false);
		});

		cmd.on('return', function(output){
			var nic = output.split('\n')[0];
			if(nic == '')
				self.emit('active_network_interface', false);
			else
				get_mac_and_ip(nic);
		});

		function get_mac_and_ip(nic){

			self.get('mac_address', nic, function(mac){

				self.get('ip_address', nic, function(ip){

					var data = {
						name: nic,
						ip_address: ip,
						mac_address: mac
					}

					self.emit('active_network_interface', data);

				});

			});

		};

	};

	this.get_first_wireless_device = function(){

		var cmd = new Command(os_functions.wireless_devices_list_cmd);

		cmd.on('error', function(e){
			self.emit('first_wireless_device', false, e.message);
		});

		cmd.on('return', function(output){
			var first_wifi_device = output.split("\n")[0];
			if(first_wifi_device != '')
				self.emit('first_wireless_device', first_wifi_device);
			else
				self.emit('first_wireless_device', false, 'No wifi devices found.');
		});
	}

};

util.inherits(Network, ReportModule);
module.exports = new Network();

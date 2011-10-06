//////////////////////////////////////////
// Prey JS Network Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		emitter = require('events').EventEmitter,
		os = require('os'),
		Command = require('../../lib/command'),
		ReportModule = require('../../core/report_module'),
		os_functions = require('./platform/' + os_name);

var Network = function(){

	ReportModule.call(this);
	var self = this;
	this.name = 'network';

	this.trace_methods = [
		'public_ip',
		'private_ip',
		'mac_address',
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
		self.emit('public_ip', '123.123.123.123');
	};

	this.get_private_ip = function(){
		os.getNetworkInterfaces().forEach(function(obj, name){
			var addr = obj[0].address;
			if(name != 'lo' && self.is_ip_address(addr)){
				return self.emit('private_ip', addr);
			}
		});
	};

	this.get_mac_address = function(){
		var cmd = new Command(os_functions.mac_addresses_list_cmd);

		cmd.on('error', function(e){
			self.emit('mac_address', false, e.message);
		});

		cmd.on('return', function(output){
			var first_mac_address = output.first_line();
			self.emit('mac_address', first_mac_address);
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

sys.inherits(Network, ReportModule);
module.exports = new Network();

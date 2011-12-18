//////////////////////////////////////////
// Prey JS System Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('../../common'),
		util = require('util'),
		os = require('os'),
		exec = require('child_process').exec,
		Provider = require('../../provider'),
		os_functions = require('./platform/' + common.os_name);

var System = function(){

	Provider.call(this);
	var self = this;
	this.name = 'system';

	this.getters = [
		'logged_user',
		'current_uptime',
		'remaining_battery',
		'cpu_load',
		'mem_usage'
	];

	this.get_logged_user = function(){
		exec(os_functions.get_logged_user_cmd, function(err, stdout, stderr){
			var user_name = stdout.toString().trim();
			if(user_name && user_name != '')
				self.emit('logged_user', user_name);
			else
				self.emit('logged_user', null, "No logged user found");
		});
	};

	// returns current uptime in seconds
	this.get_current_uptime = function(){
		self.emit('current_uptime', parseInt(os.uptime()));
	};

	// returns percentage of battery remaining in integer: ('80%' -> 80)
	this.get_remaining_battery = function(){

		os_functions.get_battery_info(function(data){
			self.emit('remaining_battery', data.percentage_remaining);
		});
	};

	this.get_cpu_load = function(){
		this.emit('cpu_load', os.loadavg()[0]);
	};

	this.get_mem_usage = function(){
		this.emit('mem_usage', os.freemem()/os.totalmem()); 
	};

	this.get_os_name = function(){
		if(common.os_name != 'linux')
			this.emit('os_name', common.os_name.charAt(0).toUpperCase() + common.os_name.slice(1));
		else{
			os_functions.get_distro_name(function(distro_name){
				self.emit('os_name', distro_name);
			})
		}
	};

	this.get_os_version = function(){
		os_functions.get_os_version(function(os_version){
			self.emit('os_version', os_version);
		})
	};

};

util.inherits(System, Provider);
module.exports = new System();

//////////////////////////////////////////
// Prey JS System Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		util = require('util'),
		os = require('os'),
		exec = require('child_process').exec,
		Getters = require('./../../../getters'),
		os_functions = require('./platform/' + common.os_name);

var System = function(){

	Getters.call(this);
	var self = this;
	// this.name = 'system';

	this.getters = [
		'logged_user',
		'uptime',
		'remaining_battery',
		'cpu_load',
		'os_name',
		'remaining_storage',
		'memory_usage'
	];

	this.get_logged_user = function(callback){

		if(process.env.LOGGED_USER) return callback(null, process.env.LOGGED_USER);

		exec(os_functions.get_logged_user_cmd, function(err, stdout, stderr){

			if(err) return callback(err);

			var user_name = stdout.toString().trim();
			if(common.os_name == 'windows') user_name = user_name.match(/\\(\w+)(\s|$)/)[1].trim();

			if(user_name && user_name != '')
				callback(null, user_name);
			else
				callback(new Error("No logged user found"));
		});

	};

	// returns current uptime in seconds
	this.get_uptime = function(callback){
		callback(null, parseInt(os.uptime()));
	};

	// returns percentage of battery remaining in integer: ('80%' -> 80)
	this.get_remaining_battery = function(callback){

		os_functions.get_battery_info(function(err, data){
			if(data)
				callback(null, data.percentage_remaining + '%');
			else
				callback(new Error("Couldn't get any battery info: " + err.toString()));
		});

	};

	this.get_cpu_load = function(callback){
		var data = os.loadavg();
		var info = { last_min: data[0], last_five: data[1], last_fifteen: data[2] };
		callback(null, info);
	};

	this.get_memory_usage = function(callback){

		var trimInt = function(number, len){
			return number.toString().substring(0, len || 4);
		}

		var mem_usage = {
			total_bytes: os.totalmem(),
			free_bytes: os.freemem(),
			used: 100 - trimInt(os.freemem()*100/os.totalmem()) + '%'
		}
		// mem_usage.used = 100 - parseFloat(mem_usage.remaining) + '%';

		callback(null, mem_usage);
	};

	this.get_os_name = function(callback){
		if(common.os_name != 'linux') {
			callback(null, common.os_name.charAt(0).toUpperCase() + common.os_name.slice(1));
		} else {
			os_functions.get_distro_name(callback);
		}
	};

	this.get_os_version = function(callback){
		os_functions.get_os_version(callback);
	};

	this.get_remaining_storage = function(callback){
		var cmd = "df -kh / | tail -1";
		exec(cmd, function(err, stdout, stderr){

			if(err) return callback(err);

			var data = stdout.toString().trim().split(/\s+/)
			var info = {size_gb: data[1], free_gb: data[3], used: data[4] };

			callback(null, info)
		})
	}

};

util.inherits(System, Getters);
module.exports = new System();

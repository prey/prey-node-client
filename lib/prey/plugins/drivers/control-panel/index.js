//////////////////////////////////////////
// Prey Control Panel Driver
// Written by Tomas Pollak
// (c) 2012, Fork Ltd. http://forkhq.com
// Licensed under the GPLv3
//////////////////////////////////////////

var fs = require('fs'),
		common = require('./../../../common'),
		logger = common.logger,
		util = require('util'),
		path = require('path'),
		Request = require('./request'),
		dispatcher = require('./../../../dispatcher'),
		hooks = require('./../../../hooks'),
		parser = require('./response_parser'),
		Emitter = require('events').EventEmitter;

var ControlPanelDriver = function(options){

	var self = this;
	// this.name = 'control-panel';
	this.events = {};
	this.interval = {};
	this.active_reports = {};

	this.options = options;
	this.device_key = options.device_key;
	this.api_key = options.api_key;
	this.cached_response_file = common.helpers.tempfile_path('last-response.xml');
	this.missing_status_code = 404;

	this.log = function(str){
		logger.info("[driver] " + str);
	};

	this.load = function(callback){
		this.check_keys(function(err, api_key, device_key){

			if(err) {
				logger.error(err);

				if(!api_key && process.env.TERM && process.env.TERM != 'dumb')
					return self.run_setup(callback);
				else
					return self.unload() || callback(err);

			}

			self.log('Control Panel keys are in place. Proceeding...')
			self.set_urls();
			self.load_hooks();
			self.start();
			callback(null, self); // OK
		});
	};

	this.load_hooks = function(){
		hooks.on('event', function(name, data){
			if (name == 'all_actions_returned')
				self.send_events();
			else if (data)
				self.events[name] = data;
		});

		hooks.on('data', function(name, data){
			// console.log("Got data from " + name);
			self.send_data(name, data, function(err, response){

				if (err && self.active_reports[name])
					self.cancel_report(name);
			});
		});

		hooks.on('trigger', this.start);
	};

	this.unload = function(err){
		if (err) logger.error(err);
		hooks.removeAllListeners();
		this.emit('unload', err);
	};

	this.set_urls = function(){
		var base_url = 'https://' + this.options.host + '/devices/' + this.device_key;
		var request_format = '.xml';

		this.endpoints = {
			device: {
				url: base_url + request_format,
				method: 'put'
			},
			events: {
				url: base_url + '/events' + request_format,
				method: 'post'
			},
			location: {
				url: base_url + '/reports' + request_format,
				method: 'post'
			}
		}
	}

	this.start = function(){
		if (common.program.connection_found)
			self.fetch();
		else
			self.check_cached_response();
	}

	this.fetch = function(){
		var urls = [this.endpoints.device.url];

		new Request(urls, this.options, function(err, resp, body){
			if (err) return self.unload(err);

			self.response_status = resp.statusCode;
			self.process(body, false);
		});
	};

	this.check_cached_response = function(){

		fs.readFile(this.cached_response_file, function(err, data){
			if (err) return self.unload(new Error('Cached response not found.'));

			logger.notice('Cached response file found! Processing...')
			self.process(data.toString(), true);
		})

	};

	this.marked_as_missing = function(requested){
		try {
			return requested.missing; // from instructions
		} catch(e) {
			return this.response_status == this.missing_status_code;
		}
	},

	this.process = function(response_body, offline){

		parser.parse(response_body, this.options, function(err, requested){

			if (err) return logger.error(err);
			else if (!requested) return logger.error('Got empty instruction set!');

			if (!offline && requested.offline_actions){
				fs.writeFile(self.cached_response_file, response_body, function(err){
					if (err) logger.error(err);
					else self.log('Stored cached version instruction set.');
				});
			}

		// var status_msg = this.marked_as_missing() ? "HOLY SHMOLY, DEVICE IS MISSING!" : "Device not missing. Sweet.";
		// logger.info(status_msg, 'bold');

			try {
				var report_url = requested.endpoints.report.control_panel.url;
				self.endpoints.location.url = report_url;
			} catch(e) { }

			self.check_active_reports(requested.reports);
			self.emit_requested(requested);

		});

	};

	this.cancel_report = function(report_name){
		// this.log('Cancelling ' + report_name + ' report.');
		this.emit('cancel', report_name);
		delete this.active_reports[report_name];
	}

	this.check_active_reports = function(reports){
	  // cancel reports that were turned off
		for (report_name in this.active_reports){
			if (!reports[report_name]) {
				this.cancel_report(report_name);
			}
		}

	  // and add to active the ones that were requested
		for (report_name in reports){
			var rep = reports[report_name];
			if (rep.interval) // persistent report requested
				this.active_reports[report_name] = rep.interval;
		}
	};

	this.send_data = function(key, data, callback){
		if (Object.keys(data).length == 0) return;

		self.log("Sending " + key + " data...");
		// console.log(JSON.stringify(data, null, 2))

		var endpoint = this.endpoints[key] ? this.endpoints[key] : this.endpoints.device;

		var options = {
			url: endpoint.url,
			method: endpoint.method,
			username: this.api_key,
			password: 'x'
		};

		dispatcher.send('http', data, options, callback);
	};

	this.send_events = function(){
		this.send_data('events', {events: this.events});
		this.events = {};
	};

	this.emit_requested = function(requested){
		this.log('Processing requested instructions...');

		for (setting in requested.settings)
			this.emit('set', setting, requested.settings[setting])

		for (data in requested.data)
			this.emit('get', data, requested.data[data]);

		for (report in requested.reports)
			this.emit('report', report, requested.reports[report]);

		if (requested.actions && Object.keys(requested.actions).length > 0)
			this.emit('actions', requested.actions);

		for (driver in requested.drivers)
			this.emit('driver', driver, requested.drivers[driver])
	};

	this.check_keys = function(callback){

		if (this.device_key == ''){
			logger.warn('Device key not present.')

			if (this.api_key == '')
				callback(new Error('No API key found.'))
			else
				this.register_device(callback);
		} else {
			callback(null, this.api_key, this.device_key);
		}

	};

	this.register_device = function(callback){

		logger.info('Attaching device to your account...');
		require('./register').new_device({api_key: this.api_key}, function(err, data){

			if (err || !data.device_key){

				var error = err || new Error("Couldn't register this device. Please try again in a sec.");
				callback(error, self.api_key);

			} else {

				logger.info('Device succesfully created. Key: ' + data.device_key);
				self.update_config_value('device_key', data.device_key, function(err){

					if (err) return callback(err, self.api_key);
					self.device_key = data.device_key;
					callback(null, self.api_key, data.device_key);

				})

			}

		});

	};

	this.run_setup = function(callback){

		setTimeout(function(){

			require('./setup').run(function(err, data){

				if (err) return callback(err);

				self.update_config_value('api_key', data.api_key, function(err){

					if (err) callback(err);
					self.api_key = data.api_key;
					self.load(callback);

				})

			})

		}, 500);

	};

	this.update_config_value = function(key, val, callback){
		var hash = {'control-panel': {}};
		hash['control-panel'][key] = val;
		common.config.merge(hash, true);
		common.config.save(callback);
	}

}

util.inherits(ControlPanelDriver, Emitter);

var instance;

exports.load = function(options, callback){
	instance = new ControlPanelDriver(options);
	instance.load(callback);
}

exports.unload = function(){
	instance.unload();
}
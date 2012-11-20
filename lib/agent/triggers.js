"use strict";

//////////////////////////////////////////
// Prey Main Provider Class
// Written by Tomas Pollak <tomas@forkhq.com>
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		fs = require('fs'),
		path = require('path'),
		triggers_path = __dirname + '/plugins/triggers';

var Triggers = {

	events: {},

	get: function(event_name){

		if(Object.keys(this.events) === 0) this.map();
		return this.events[event_name];

	},

	map: function(callback){

		if(Object.keys(this.events) > 0) return callback(this.events);

		var self = this, files = fs.readdirSync(triggers_path);
		files.forEach(function(trigger_name, i){
      
			var trigger_path = path.join(triggers_path, trigger_name);
			var trigger_events = require(trigger_path).events || [];

			trigger_events.forEach(function(event){
				// self.events[event] = trigger_path;
				self.events[event] = trigger_name;
			});
		});

		callback(this.events);
	}

};

module.exports = Triggers;

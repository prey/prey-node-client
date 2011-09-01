//////////////////////////////////////////
// Prey JS System Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		Command = require('../../lib/command'),
		ActionModule = require('../../core/action_module');

var System = function(){

	ActionModule.call(this);
	var self = this;
	this.name = 'system';

	this.start = function(){

		console.log(' -- Getting system information...')
		// this.done();

	}

	this.stop = function(){

		console.log(' -- Stopping...')

	}

};

sys.inherits(System, ActionModule);
module.exports = new System();

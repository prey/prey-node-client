//////////////////////////////////////////
// Prey Control Panel Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		HTTPTransport = require('./http');

var ControlPanelTransport = function(report, options){

	HTTPTransport.call(this, report, options || {});
	var self = this;
	this.destination = 'control_panel';

	this.options.password = 'x';

}

util.inherits(ControlPanelTransport, HTTPTransport);
module.exports = ControlPanelTransport;

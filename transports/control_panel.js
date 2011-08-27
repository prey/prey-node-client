//////////////////////////////////////////
// Prey Control Panel Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		HTTPTransport = require(base_path + '/transports/http');

var ControlPanelTransport = function(report, options){

	HTTPTransport.call(this, report, options || {});
	var self = this;

	this.options.username = config.api_key;
	this.options.password = 'x';
	this.post_url = this.post_url || config.check_url + "/devices/" + config.device_key + "/reports.xml";

}

sys.inherits(ControlPanelTransport, HTTPTransport);
module.exports = ControlPanelTransport;

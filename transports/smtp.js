//////////////////////////////////////////
// Prey SMTP Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		Transport = require(base_path + '/core/transport');

var SMTPTransport = function(report, options){

	Transport.call(this, report, options || {});
	var self = this;
	this.destination = 'smtp';

	this.send = function(data){

		console.log(" -- Work in progress!");

	}

}

sys.inherits(SMTPTransport, Transport);
module.exports = SMTPTransport;

//////////////////////////////////////////
// Prey SMTP Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		dns = require('dns'),
		mailer = require('nodemailer'),
		Transport = require('../core/transport');

var SMTPTransport = function(report, options){

	Transport.call(this, report, options);
	var self = this;
	this.destination = 'smtp';

	this.send = function(data){

		self.emit('start');

		this.build_email(data, function(email_body){

			self.get_smtp(self.options.recipient, function(host){

				self.send_email(self.options.to, host, email_body, function(err){

					self.emit('end');

				});

			});

		});

	}

	this.build_email = function(data, callback){

		callback(JSON.stringify(data));

	}

	this.get_smtp = function(email, callback){

		var domain = email.replace(/.*@/, '');
		console.log(domain);

		dns.resolveMx(domain, function (err, addresses) {
			if (err) throw err;

			// console.log('addresses: ' + JSON.stringify(addresses));

			callback(addresses[0].exchange);

//			for(i in addresses){

//				var host = addresses[i];
//				if(callback(host)) break;

//			}

		});

	}

	this.send_email = function(address, host, text, callback){

		console.log(' -- Sending to ' + address + ' at ' + host);

		// one time action to set up SMTP information
		mailer.SMTP = {
			host: host
		}

		// send an e-mail
		mailer.send_mail({
				sender: this.options.from,
				to: address,
				subject: this.options.subject,
				body: text
			},
			function(error, success){
				console.log('Message ' + success ? 'sent' : 'failed');
			}
		);

	};

}

sys.inherits(SMTPTransport, Transport);
module.exports = SMTPTransport;

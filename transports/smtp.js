//////////////////////////////////////////
// Prey SMTP Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
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

			self.get_smtp_servers(self.options.recipient, function(hosts){

				self.try_to_send(hosts, email_body, 0);

			});

		});

	};

	this.build_email = function(data, callback){

		callback(JSON.stringify(data));

	};

	this.get_smtp_servers = function(email, callback){

		var domain = email.replace(/.*@/, '');
		// console.log(domain);

		dns.resolveMx(domain, function(err, addresses) {

			if (err) throw err;
			var hosts = [];

			var sorted = addresses.sort(function(a, b){ return (a.priority > b.priority); });

			sorted.forEach(function(host){
				hosts.push(host.exchange);
			});

			callback(hosts);

		});

	};

	this.try_to_send = function(hosts, body, attempt){

		var host = hosts[attempt];
		if(typeof host == 'undefined'){
			console.log(" !! No more SMTP servers available!");
			this.emit('end', true);
			return false;
		}

		this.send_email(this.options.recipient,
										this.options.from,
										this.options.subject,
										host,
										body,
										function(success){

											if(success)
												return self.emit('end');
											else
												return self.try_to_send(hosts, body, ++attempt);

										}
		);

	};

	this.send_email = function(to, from, subject, host, body, callback){

		console.log(' -- Trying to send to ' + to + ' at ' + host);

		// one time action to set up SMTP information
		mailer.SMTP = {
			host: host
		}

		// send an e-mail
		mailer.send_mail({
				sender: from,
				to: to,
				subject: subject,
				body: body
			},
			function(error, success){
				if(error) console.log(" !! " + error);
				if(success) console.log(' -- Message sent!');

				callback(success);
			}
		);

	};

}

util.inherits(SMTPTransport, Transport);
module.exports = SMTPTransport;

//////////////////////////////////////////
// Prey SMTP Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		dns = require('dns'),
		mailer = require('nodemailer'),
		fs = require('fs'),
		path = require('path'),
		Transport = require('../core/transport');

var SMTPTransport = function(report, options){

	Transport.call(this, report, options);
	var self = this;
	this.destination = 'smtp';

	this.send = function(data){

		self.emit('start');

		this.build_email(data, function(email_data){

			self.get_smtp_servers(self.options.recipient, function(hosts){

				self.try_to_send(hosts, email_data, 0);

			});

		});

	};

	this.format_data = function(hash, callback){

		var body = "";
		var attachments = [];

		for(key in hash){

			var obj = hash[key];
			for(k in obj){

				var val = obj[k];

				var field = key + '__' + k;

				if(val instanceof String || val instanceof Number) {

					body += field + " :: " + val + "\n";

				} else {

					if (val.path){

						attachments.push({
							filename: path.basename(val.path),
							contents: fs.readFileSync(val.path)
						});

					} else if (val != false) {
						body += field + " :: " + JSON.stringify(val) + "\n";
					}

				}

			}

		};

		callback(body, attachments);

	};

	this.build_email = function(data, callback){

		var email_data = {
			sender: this.options.from,
			to: this.options.recipient,
			subject: this.options.subject,
			headers: {
				'X-Mailer': this.options.user_agent
			},
			debug: process.env.DEBUG
		}

		this.format_data(data, function(body, attachments){

			email_data.body = body;
			if(attachments.length > 0) email_data.attachments = attachments;
			callback(email_data);

		});

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

	this.try_to_send = function(hosts, email_data, attempt){

		var host = hosts[attempt];
		if(typeof host == 'undefined'){
			this.log("No more SMTP servers available!");
			this.emit('end', true);
			return false;
		}

		this.send_email(host, email_data, function(success){

			if(success)
				return self.emit('end');
			else
				return self.try_to_send(hosts, email_data, ++attempt);

		});

	};

	this.send_email = function(host, email_data, callback){

		this.log('Trying to send to ' + email_data.to + ' at ' + host);

		if(!this.em) this.em = new mailer.EmailMessage(email_data);
		else { // nasty fix to prevent nodemailer from duplicating from/to addresses
			this.em.fromAddress = [];
			this.em.toAddress = [];
		}

		this.em.SERVER = { host: host }
		this.em.send(function(error, success){

			if(error) self.log("!! " + error);
			if(success) self.log(' -- Message sent!');

			return callback(success);

		});

	};

}

util.inherits(SMTPTransport, Transport);
module.exports = SMTPTransport;

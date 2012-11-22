//////////////////////////////////////////
// Prey SMTP Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		util = require('util'),
		dns = require('dns'),
		mailer = require('nodemailer'),
		fs = require('fs'),
		path = require('path'),
		Transport = require('./../../../transport');

var SMTPTransport = function(options){

	Transport.call(this, options);
	var self = this;
	this.name = 'smtp';

	this.recipient = options.to || options.recipient;
	this.subject = options.subject || '[Prey] Status Report @ ' + new Date().toUTCString();
	this.sender = options.sender || 'Prey Anti-Theft <no-reply@gmail.com>';
	this.user_agent = options.user_agent || common.user_agent;

	this.send = function(data, callback){

		this.emit('start');
		this.data = data;
		this.callback = callback;

		if(!this.recipient)
			return this.done(new Error("You need to provide a recipient!"));

		this.build_email(data, function(email_data){

			self.get_smtp_servers(function(err, hosts){

				if(err) return callback(err);
				self.try_to_send(hosts, email_data, 0);

			});

		});

	};

	this.done = function(err, response){
		self.emit('end', err, this.data);
		this.callback(err, response);
	};

	this.format_data = function(data, callback){

		var body = [], attachments = [];

		for(key in data){

			var val = data[key];
			if(!val) continue;

			if(val.file && val.content_type){

				attachments.push({
					filename: path.basename(val.file),
					contents: fs.readFileSync(val.file)
				});

			} else {

				var str = (val instanceof String) ? val : JSON.stringify(val);
				body.push(key + " :: " + str);

			}

		};

		callback(body.join("\n"), attachments);

	};

	this.build_email = function(data, callback){

		var email_data = {
			sender: this.sender,
			to: this.recipient,
			subject: this.subject,
			headers: {
				'X-Mailer': this.user_agent
			},
			debug: process.env.DEBUG
		}

		this.format_data(data, function(body, attachments){

			email_data.body = body;
			if(attachments.length > 0) email_data.attachments = attachments;
			callback(email_data);

		});

	};

	this.get_smtp_servers = function(callback){

		var domain = this.recipient.replace(/.*@/, '');
		// console.log(domain);

		dns.resolveMx(domain, function(err, addresses) {

			if (err) return callback(err);

			var hosts = [];
			var sorted = addresses.sort(function(a, b){ return (a.priority > b.priority); });

			sorted.forEach(function(host){
				hosts.push(host.exchange);
			});

			callback(null, hosts);

		});

	};

	this.try_to_send = function(hosts, email_data, attempt){

		var host = hosts[attempt];

		if(typeof host == 'undefined')
			return this.done(new Error("No more SMTP servers available."));

		this.send_email(host, email_data, function(err){

			if(!err)
				return self.done(null, email_data);

			common.logger.error(err);
			self.try_to_send(hosts, email_data, ++attempt);

		});

	};

	this.send_email = function(host, email_data, callback){

		this.log('Trying to send to ' + email_data.to + ' at ' + host);

		var transport_opts = {host: host, secureConnection: false}; // SSL bug?
		var transport = mailer.createTransport("SMTP", transport_opts);
		email_data.transport = transport;

		mailer.sendMail(email_data, function(err){
			transport.close();
			callback(err);
		});

	};

}

util.inherits(SMTPTransport, Transport);

exports.send = function(data, options, callback){
	var transport = new SMTPTransport(options);
	transport.send(data, callback);
};

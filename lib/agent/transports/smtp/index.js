//////////////////////////////////////////
// Prey Email Endpoint
// (c) 2013 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs        = require('fs'),
    path      = require('path'),
    util      = require('util'),
    dns       = require('dns');

var default_from = 'Prey <prey-anti-theft@somewhere.com>';

var default_subject = function() {
  return 'Prey Status Report @ ' + new Date().toUTCString();
}

var format_data = function(data, cb) {
  var body = [],
      attachments = [];

  for (var key in data) {

    var val = data[key];
    if (!val || val == '') continue;

    if (val.file && val.content_type) {
      attachments.push({
        filename: path.basename(val.file),
        contents: fs.readFileSync(val.file)
      });
    } else {
      var str = (val instanceof String) ? val : JSON.stringify(val);
      body.push(key + ' :: ' + str);
    }

  };

  cb(body.join('\n'), attachments);
};

var build_email = function(opts, data, cb) {

  var email = opts;
  format_data(data, function(body, attachments) {

    email.body = body;
    if (attachments.length > 0)
      email.attachments = attachments;

    cb(email);
  });

};

var get_smtp_servers = function(recipient, cb) {

  var domain = recipient.replace(/.*@/, '');
  dns.resolveMx(domain, function(err, addresses) {

    if (err) return cb(err);

    var hosts = [];
    var sorted = addresses.sort(function(a, b){ return (a.priority > b.priority) });

    sorted.forEach(function(host){
      hosts.push(host.exchange);
    });

    cb(null, hosts);
  });

};

var send_email = function(hosts, email_data, attempt, cb) {

  var host = hosts[attempt];

  if (typeof host == 'undefined')
    return cb && cb(new Error('No more SMTP servers to deliver to. Attempts: ' + attempt));

  deliver(host, email_data, function(err){
    if (!err)
      return cb && cb(null, email_data);

    // common.logger.error(err);
    send_email(hosts, email_data, ++attempt, cb);
  });

};

var deliver = function(host, email_data, cb){
  // console.log('Delivering email to ' + email_data.to + ' at ' + host);

  var opts      = { host: host, secure: true, connectionTimeout: 20000 };

};

exports.send = function(data, opts, cb) {

  var mail_opts = {
    to          : opts.to      || opts.recipient,
    subject     : opts.subject || default_subject(),
    sender      : opts.sender  || default_from
  }

  if (!mail_opts.to || mail_opts.to == '')
    return cb && cb(new Error('You need to provide a recipient!'));

  // logger.debug('Writing email...');
  build_email(mail_opts, data, function(email) {

    // logger.debug('Fetching SMTP servers for ' + mail_opts.to);
    get_smtp_servers(mail_opts.to, function(err, hosts) {
      if (err) return cb && cb(err);

      send_email(hosts, email, 0, cb);
    });

  });

};

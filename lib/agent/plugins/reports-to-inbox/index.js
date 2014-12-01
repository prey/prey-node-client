var agent,
    recipient;

function send_report(type, data) {
  agent.transports.smtp.send(data, { to: recipient })
}

exports.load = function(cb) {
  if (!this.config.get('recipient'))
    return cb(new Error('Recipient not found.'));

  agent = this;
  recipient = this.config.get('recipient');

  agent.hooks.on('report', send_report);
  cb(); // notify that plugin has loaded
}

exports.unload = function() {
  agent.hooks.remove('report', send_report);
}

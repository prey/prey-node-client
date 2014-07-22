var agent,
    recipient;

function send_report(type, data) {
  agent.transports.smtp.send(data, { to: recipient })
}

exports.load = function(common, cb) {
  if (!common.config.get('recipient'))
    return cb(new Error('Recipient not found.'));

  agent = common;

  recipient = common.config.get('recipient');
  agent.hooks.on('report', send_report);
  cb && cb();
}

exports.unload = function(cb) {
  agent.hooks.remove('report', send_report);
  cb && cb();
}

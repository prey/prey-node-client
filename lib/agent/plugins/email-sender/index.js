var recipient;

function send_report(type, data) {
  common.endpoints.email.send(data, { to: recipient })
}

exports.load = function(common, cb) {
  if (!common.config.get('recipient'))
    return cb(new Error('Recipient not found.'));

  recipient = common.config.get('recipient');
  common.hooks.on('report', send_report);
  cb && cb();
}

exports.unload = function(cb) {
  common.hooks.unload('report', send_report);
  cb && cb();
}
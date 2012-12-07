var dialog = require('dialog');

exports.start = function(opts, cb){
  var opts = opts || {},
      message = opts.message;

  if (!message || message == '')
    return cb(new Error('Alert requires a message.'))

  dialog.info(message);
  cb();
}

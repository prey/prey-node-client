var dialog = require('dialog'),
    system = require('./../../common').system;

dialog.run = function(args, cb){
  var bin = args.shift();

  if (process.platform == 'darwin'){
    args[1] = args[1].replace(/"/g, '\\"');
  }

  system.spawn_as_logged_user(bin, args, function(err, child){
    if (err) return;

    child.on('exit', function(code){
      // console.log(code);
    })
  });
}

exports.start = function(opts, cb){

  var opts = opts || {},
      message = opts.message || opts.alert_message;

  if (!message || message == '')
    return cb(new Error('Alert requires a message.'));

  dialog.info(message);
  cb();
}

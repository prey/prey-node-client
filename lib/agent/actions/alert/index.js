var dialog  = require('dialog'),
    system  = require('./../../common').system,
    EE      = require('events').EventEmitter;

dialog.run = function(args, cb) {
  var bin = args.shift();

  system.spawn_as_logged_user(bin, args, function(err, child) {
    if (err) return cb(err);

    child.stdout.on('data', function(x){
      // console.log(x.toString());
    })

    child.on('exit', function(code) {
      module.emitter.emit('end');
      done();
    })

    cb(null, child);
  });
}

var done = function() {
  child = null;
}

exports.start = function(opts, cb) {
  var opts = opts || {},
      message = opts.message || opts.alert_message;

  if (!message || message == '')
    return cb(new Error('Alert requires a message.'));

  dialog.info(message, 'Important', function(err, child) {
    if (err) return cb(err);

    module.child = child;
    module.emitter = new EE();
    cb(null, module.emitter);
  });
}

exports.stop = function(cb) {
  if (!module.child)
    return cb && cb(new Error('Not running'));

  module.child.kill();
  done();
}

// Prey Alert
// Written by Tomas Pollak

var join    = require('path').join,
    system  = require('./../../common').system,
    flash   = join(__dirname, process.platform, 'flash'),
    Emitter = require('events').EventEmitter,
    is_win  = process.platform == 'win32';

var child,
    emitter,
    user_input_str = 'User input: ';

exports.start = function(opts, cb) {
  var opts    = opts || {},
      message = opts.message || opts.alert_message,
      title   = opts.title,
      level   = opts.level || 'info',
      reply   = opts.reply || opts.entry || opts.response;

  if (!message || message.toString().trim() == '')
    return cb(new Error('Message required'));

  var reply,
      returned = 0,
      bin      = flash,
      args     = ['-l', level];

  if (reply)
    args = args.concat(['-e', 'Type here:']);

  if (title && title.toString().trim() != '')
    args = args.concat(['-t', title]);

  if (is_win) {
    args.push('-m'); // in windows, the bin expects a -m message argument
    bin += '.exe';
  } else {
    bin += '.py';
  }

  function done(err) {
    if (returned++) return;

    if (emitter)
      emitter.emit('end', err, reply);

    emitter = null;
  }

  // remove newlines so the message can be completely displayed
  message = message.replace(/(\r\n|\n|\r)/gm," ");

  args.push(message);
  system.spawn_as_logged_user(bin, args, function(err, alert) {
    if (err) return done(err);

    alert.stdout.on('data', function(chunk) {
      if (chunk.toString().match(user_input_str)) {
        reply = chunk.toString().replace(user_input_str, '').trim();
      }
    });

    alert.on('error', done);

    alert.once('exit', function() {
      child = null;
      done();
    });

    child = alert;
    emitter = new Emitter();
    cb(null, emitter);
  });

}

exports.stop = function() {
  // if child is killed, the 'exit' event is triggered
  // and it will fire the emitter's end' event, marking
  // the action as stopped.
  if (child && !child.exitCode) {
    child.kill();
  }
}

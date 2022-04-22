// Prey Alert
// Written by Tomas Pollak

var join        = require('path').join,
    common      = require('./../../common'),
    system      = common.system,
    flash       = join(__dirname, process.platform, 'flash'),
    prey_app    = join(__dirname, '..', '..', 'utils', 'Prey.app'),
    actions_app = join(__dirname, '..', '..', 'utils', 'prey-actions.app'),
    Emitter     = require('events').EventEmitter,
    is_win      = process.platform == 'win32',
    is_mac      = process.platform == 'darwin';

var child,
    emitter,
    app,
    binary,
    user_input_str = 'User input: ';

exports.start = function(id, opts, cb) {
  var opts    = opts || {},
      message = opts.message || opts.alert_message,
      title   = opts.title,
      level   = opts.level || 'info',
      reply   = opts.reply || opts.entry || opts.response;

  if (!message || message.toString().trim() == '')
    return cb(new Error('Message required'));

  // remove newlines so the message can be completely displayed
  message = message.toString().replace(/(\r\n|\n|\r)/gm," ");

  var reply,
      returned = 0,
      bin      = flash,
      args     = ['-l', level];

  if (reply)
    args = args.concat(['-e', 'Type here:']);

  if (title && title.toString().trim() != '')
    args = args.concat(['-t', title]);

  if (is_win) {
    args.push('-m', message); // in windows, the bin expects a -m message argument
    bin += '.exe';
  } else if (is_mac) {
    args.push(message);
    bin += '.py';
  } else {
    args.push(message);
    bin += ((system.python_version && system.python_version >= "3.0.0") ? '3.py' : '.py');
  }

  if (is_mac && common.os_release >= '10.14') {
    app = prey_app;
    binary = 'Prey';
    if (common.os_release >= '11.0') {
      app = actions_app;
      binary = 'prey-actions';
    }
      
    bin  = join(app, 'Contents', 'MacOS', binary);
    args = ['-alert', message];
  }

  function done(err) {
    if (returned++) return;

    if (emitter)
      emitter.emit('end', id, err, reply);

    emitter = null;
  }

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
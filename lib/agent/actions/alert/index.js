// Prey Alert
// Written by Tomas Pollak

var join    = require('path').join,
    // spawn   = require('child_process').spawn,
    system  = require('./../../common').system,
    bin     = join(__dirname, process.platform, 'flash'),
    Emitter = require('events').EventEmitter,
    is_win  = process.platform == 'win32';

var child,
    user_input_str = 'User input: ';

exports.start = function(opts, cb) {
  var opts    = opts || {},
      message = opts.message || opts.alert_message,
      level   = opts.level || 'info';

  if (!message || message.trim() == '')
    return cb(new Error('Message required'));

  var reply,
      args = ['-l', level, '-e', 'true'];

  if (is_win) {
    args.push('-m'); // in windows, the bin expects a -m message argument
    bin += '.exe';
  } else {
    bin += '.py';
  }

  args.push(message);
  system.spawn_as_logged_user(bin, args, function(err, child) {
    if (err) return cb(err);

    child.stdout.on('data', function(chunk) {
      if (chunk.toString().match(user_input_str)) {
        reply = chunk.toString().replace(user_input_str, '').trim();
      }
    });

    child.on('exit', function() {
      emitter.emit('end', null, reply);
    });

    emitter = new Emitter();
    cb(null, emitter);
  });

}

exports.stop = function() {
  if (!child)
    return cb && cb(new Error('Not running'));

  child.kill();
  child = null;
}

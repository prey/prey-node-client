// Prey Alert

var join        = require('path').join,
    common      = require('./../../common'),
    system      = common.system,
    flash       = join(__dirname, process.platform, 'flash'),
    prey_app    = join(__dirname, '..', '..', 'utils', 'Prey.app'),
    actions_app = join(__dirname, '..', '..', 'utils', 'prey-actions.app'),
    Emitter     = require('events').EventEmitter,
    is_win      = process.platform == 'win32',
    is_linux    = process.platform == 'linux';

var child,
    emitter,
    timer,
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

  var bin = flash,
      args = ['-l', level];

  if (reply)
    args = args.concat(['-e', 'Type here:']);

  if (title && title.toString().trim() != '')
    args = args.concat(['-t', title]);

  if (is_win) {
    args.push('-m', message); // in windows, the bin expects a -m message argument
    args.push('-t', '');
    bin += '.exe';

  } else if (is_linux) {
    bin = "zenity";
    args = ['--info', '--text=' + message];

    system.get_env((err, env) => {
      // Overwrite ENV variables for logged user
      if (!err && env) {
        process.env.DISPLAY = env.display;
        process.env.XAUTHORITY = env.xauthority;
      }
    });

  } else {
    if (common.os_release >= '10.14') {
      app = prey_app;
      binary = 'Prey';
      if (common.os_release >= '11.0') {
        app = actions_app;
        binary = 'prey-actions';
      }

      bin  = join(app, 'Contents', 'MacOS', binary);
      args = ['-alert', message];
    } else {
      return cb(new Error('Alert action is not supported on this macOS version'));
    }
  }

  // Guard against double-emit: once emitter is nulled, further done() calls no-op.
  function done(err) {
    if (!emitter) return;
    emitter.emit('end', id, err, reply);
    emitter = null;
  }

  function trySpawn() {
    timer = null;
    system.spawn_as_logged_user(bin, args, function(err, alert) {
      if (err) {
        // Retry when the user session is not yet active (e.g. lock screen).
        // Mirrors the same pattern used by the lock action.
        // The action is intentionally NOT in running[id] during this wait.
        if (err.code === 'NO_LOGGED_USER') {
          timer = setTimeout(trySpawn, 5000);
          return;
        }
        // Hard failure: propagate error through cb so actions.js can mark it failed.
        return cb(err);
      }

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

      // Create emitter on first successful spawn (matches lock-action pattern).
      // The action only enters running[id] once flash.exe is actually running.
      if (!emitter) {
        emitter = new Emitter();
        cb(null, emitter);
      }
    });
  }

  trySpawn();
}

exports.stop = function() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    // Action was not in running[id] yet — no emitter to emit 'end' on.
    return;
  }

  // if child is killed, the 'exit' event is triggered
  // and it will fire the emitter's 'end' event, marking
  // the action as stopped.
  if (child && !child.exitCode) {
    child.kill();
  }
}

/* eslint-disable linebreak-style */
// Prey Alert
// Written by Tomas Pollak

const { join } = require('path');
const common = require('../../common');

const { system } = common;
const flash = join(__dirname, process.platform, 'flash');
const preyApp = join(__dirname, '..', '..', 'utils', 'Prey.app');
const actionsApp = join(__dirname, '..', '..', 'utils', 'prey-actions.app');
// eslint-disable-next-line import/order
const Emitter = require('events').EventEmitter;

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

let child;
let emitter;
let app;
let binary;
const userInputStr = 'User input: ';

// eslint-disable-next-line consistent-return
exports.start = (id, opts, cb) => {
  let message = opts.message || opts.alert_message;
  const { title } = opts;
  const level = opts.level || 'info';
  let reply = opts.reply || opts.entry || opts.response;

  if (!message || message.toString().trim() === '') return cb(new Error('Message required'));

  // remove newlines so the message can be completely displayed
  message = message.toString().replace(/(\r\n|\n|\r)/gm, ' ');

  let returned = 0;
  let bin = flash;
  let args = ['-l', level];

  if (reply) args = args.concat(['-e', 'Type here:']);

  if (title && title.toString().trim() !== '') args = args.concat(['-t', title]);

  if (isWin) {
    args.push('-m', message); // in windows, the bin expects a -m message argument
    bin += '.exe';
  } else if (isMac) {
    args.push(message);
    bin += '.py';
  } else {
    args.push(message);
    bin += ((system.python_version && system.python_version >= '3.0.0') ? '3.py' : '.py');
  }

  if (isMac && common.os_release >= '10.14') {
    app = preyApp;
    binary = 'Prey';
    if (common.os_release >= '11.0') {
      app = actionsApp;
      binary = 'prey-actions';
    }

    bin = join(app, 'Contents', 'MacOS', binary);
    args = ['-alert', message];
  }

  const done = (err) => {
    // eslint-disable-next-line no-plusplus
    if (returned++) return;

    if (emitter) emitter.emit('end', id, err, reply);

    emitter = null;
  };

  // eslint-disable-next-line consistent-return
  system.spawn_as_logged_user(bin, args, (err, alert) => {
    if (err) return done(err);

    alert.stdout.on('data', (chunk) => {
      if (chunk.toString().match(userInputStr)) reply = chunk.toString().replace(userInputStr, '').trim();
    });

    alert.on('error', done);

    alert.once('exit', () => {
      child = null;
      done();
    });

    child = alert;
    emitter = new Emitter();
    cb(null, emitter);
  });
};

exports.stop = () => {
  // if child is killed, the 'exit' event is triggered
  // and it will fire the emitter's end' event, marking
  // the action as stopped.
  if (child && !child.exitCode) {
    child.kill();
  }
};

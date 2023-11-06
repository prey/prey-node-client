/*
/ Prey osquery installer
/ (C) 2023 Prey, Inc.
*/
const path = require('path');
const Emitter = require('events').EventEmitter;
const common = require('../../../common');
const sudo = require('sudoer');

const join = path.join;
const { paths } = common.system;
const { system } = common;
const logger = common.logger.prefix('osquery');

const osName = process.platform
  .replace('win32', 'windows')
  .replace('darwin', 'mac');
// TODO: to be used for environment creation
const keys = require('../../plugins/control-panel/api/keys');
// This script lets us call programs as a local user rather than root.
// Usage: ./runner.js [user_name] [command] [arg1] [arg2] [arg3]

var cp = require('child_process');
(exec = cp.exec),
  (spawn = cp.spawn),
  (args = process.argv),
  (sudo_bin = '/usr/bin/sudo');

// console.log('Current uid: ' + process.getuid());

var run_command = function (command, args) {
  // console.log("Running " + command + " with uid " + process.getuid());

  var opts = { env: process.env };

  if (process.platform == 'linux' && !opts.env.DISPLAY) opts.env.DISPLAY = ':0'; // so it uses active display

  var child = spawn(command, args, opts);

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  child.on('exit', function (code) {
    logger.info('exit ' + code);
    setTimeout(function () {
      process.exit(code);
    }, 10);
  });

  process.on('SIGTERM', function () {
    logger.info('SIGTERM ' + code);
    child.kill('SIGTERM');
  });

  process.on('SIGINT', function () {
    logger.info('SIGINT ' + code);
    child.kill('SIGINT');
  });
};

var safe_escape = function (str) {
  return str.replace(/[\"\`\$\|]/g, '\\$&');
};

args = args.map(function (a) {
  return safe_escape(a);
});

let child;
let emitter;

/**
 * Perform installation of osquery binary
 *
 * @param {function} cb - The callback function to be called after the installation.
 * @return {undefined} No return value.
 */

exports.start = (id, opts, cb) => {
  function done(err = null) {
    if (emitter) {
      emitter.emit('end', id, err);
    }

    emitter = null;
  }

  // const args = [
  //   'root',
  //   '-c',
  //   '"/Users/patojofre/Desktop/prey/prey-node-client/bin/trinity --osquery_version=5.8.2 --env=staging --host=oqtls-stg.preyhq.com"',
  // ];

  const safeEscape = (str) => str.replace(/[\"\`\$\|]/g, '\\$&');

  let args = [
    '--osquery_version',
    '5.9.1',
    '--host',
    'oqtls-stg.preyhq.com',
    '--env',
    'staging',
  ];
  args = args.map((a) => safeEscape(a));
  const cmd = join(paths.current, 'bin', 'trinity');
  command = ['"' + cmd].concat(args).join('" "') + '"';
  args = ['-n', 'su', 'root', '-c', command];
  command = sudo_bin;
  run_command(command, args);

  //command = ['"' + command].concat(args).join('" "') + '"';
  //

  // sudo(cmd, args, (err, stdout, stderr) => {
  //   logger.info(err);
  //   logger.info(stdout);
  //   logger.info(stderr);
  //   if (stdout) {
  //     logger.info(stdout);
  //   }

  //   if (stderr) {
  //     done(new Error(`error installing osquery 1. ${stderr}`));
  //   }

  //   if (err) {
  //     done(new Error(`error installing osquery 2. ${err}`));
  //   }

  //   logger.info('runInstallation ok');
  //   if (!emitter) {
  //     emitter = new Emitter();
  //     // eslint-disable-next-line no-unused-expressions
  //     cb && cb(null, emitter);
  //   }
  // });
};

exports.stop = () => {
  logger.info('inside stop');
  if (child && !child.exitCode) {
    logger.info('killing child');
    child.kill();
  }
};

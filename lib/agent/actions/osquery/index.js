/*
/ Prey osquery installer
/ (C) 2023 Prey, Inc.
*/
const path = require('path');
const Emitter = require('events').EventEmitter;
const common = require('../../../common');

const { join } = path;
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

  const bin = join(paths.current, 'bin', 'trinity');
  let args = null;

  switch (opts.mode) {
    case 'install':
      args = [
        '--osquery_version',
        opts.version,
        '--host',
        opts.host,
        '--env',
        opts.environment,
      ];
      break;

    case 'uninstall':
      args = [' --uninstall', true];
      break;

    default:
      done(new Error('Invalid option'));
  }

  // eslint-disable-next-line consistent-return
  system.run_as_root(bin, args, { timeout: 5000 }, (err, data) => {
    if (err || (data && data.includes('error'))) {
      const msgErr = `error ${opts.mode} osquery. ${err}`;
      logger.info(msgErr);
      done(new Error(msgErr));
    }

    logger.info(`${opts.mode} instruction executed successfully`);

    if (!emitter) {
      emitter = new Emitter();
      // eslint-disable-next-line no-unused-expressions
      cb && cb(null, emitter);
    }
  });
};

exports.stop = () => {
  logger.info('inside stop');
  if (child && !child.exitCode) {
    logger.info('killing child');
    child.kill();
  }
};

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

const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');

let child;
let emitter;
let action = 'osquery-install';

/**
 * Perform installation of osquery binary
 *
 * @param {function} cb - The callback function to be called after the installation.
 * @return {undefined} No return value.
 */

exports.start = (id, opts, cb) => {
  function done(err = null) {
    if (!emitter) emitter = new Emitter();
    emitter.emit('end', id, err);
    if (cb && typeof cb === 'function') cb(err);
  }

  let bin = join(paths.current, 'bin', 'trinity');
  let args = null;
  const data = {
    key: 'device-key',
    token: 'token',
    logged: false,
  };

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
      data.dirs = [opts.version, opts.host, opts.environment];
      break;

    case 'uninstall':
      args = [' --uninstall', true];
      action = 'osquery-uninstall';
      data.dirs = [true];
      break;

    default:
      done(new Error('Invalid option'));
  }

  if (osName === 'windows') {
    bin += '.exe'; // hay que agregar el exe?
    // eslint-disable-next-line consistent-return
    return system.spawn_as_admin_user(bin, args, (errTrinity, osQueryInstallAction) => {
      if (errTrinity) {
        logger.info(errTrinity);
        return done(new Error(errTrinity));
      }
      if (typeof osQueryInstallAction !== 'function') return done(new Error('Error is not available'));
      // eslint-disable-next-line consistent-return
      osQueryInstallAction(action, data, (errOsQueryInstallAction, outPutOsQueryInstallAction) => {
        if (outPutOsQueryInstallAction && outPutOsQueryInstallAction.code !== 0) {
          const errorOutPut = new Error('Error on osQuery');
          return done(errorOutPut);
        }
        logger.info(`${opts.mode} instruction executed successfully`);
        done();
      });
    });
  }

  // eslint-disable-next-line consistent-return
  system.run_as_root(bin, args, { timeout: 5000 }, (err, dataRoot) => {
    if (err || (dataRoot && dataRoot.includes('error'))) {
      const msgErr = `error ${opts.mode} osquery. ${err}`;
      logger.info(msgErr);
      return done(new Error(msgErr));
    }
    logger.info(`${opts.mode} instruction executed successfully`);
    done();
  });
};

exports.stop = () => {
  logger.info('inside stop');
  if (child && !child.exitCode) {
    logger.info('killing child');
    child.kill();
  }
};

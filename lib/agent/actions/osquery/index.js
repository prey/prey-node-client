/*
/ Prey osquery installer
/ (C) 2023 Prey, Inc.
*/
const path = require('path');
const Emitter = require('events').EventEmitter;
const sudo = require('sudoer');
const fs = require('fs');
const common = require('../../../common');

const { join } = path;
const { paths } = common.system;
const { system } = common;
const logger = common.logger.prefix('osquery');

const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');

let child;
let emitter;
let action = 'osquery-install';

const checkOsqueryPath = (mode) => {
  const osqueryPath = '/private/var/prey';
  try {
    const stats = fs.statSync(osqueryPath);
    if (stats.isDirectory() && mode === 'install') {
      // Directory exists
      return true;
    }
    return false;
  } catch (err) {
    if (err.code === 'ENOENT' && mode === 'uninstall') {
      // Directory doesn't exists
      return true;
    }
    return `Error occurred while checking directory: ${err}`;
  }
};

const osqueryWindows = (bin, actionWin, data, mode, done) => {
  const binWin = `${bin}.exe`;
  // eslint-disable-next-line consistent-return
  system.spawn_as_admin_user(binWin, data, (errTrinity, osQueryInstallAction) => {
    if (errTrinity) {
      logger.info(errTrinity);
      return done(new Error(errTrinity));
    }
    if (typeof osQueryInstallAction !== 'function') return done(new Error('Error is not available'));
    // eslint-disable-next-line consistent-return
    osQueryInstallAction(actionWin, data, (errOsQueryInstallAction, outPutOsQueryInstallAction) => {
      if (errOsQueryInstallAction || (outPutOsQueryInstallAction
        && (!Object.prototype.hasOwnProperty.call(outPutOsQueryInstallAction, 'code') || outPutOsQueryInstallAction.code !== 0))) {
        const errorOutPut = new Error('Error on osQuery');
        return done(errorOutPut);
      }
      logger.info(`${mode} instruction executed successfully`);
      done();
    });
  });
};

const osqueryUnix = (bin, args, mode, done) => {
  // eslint-disable-next-line consistent-return
  sudo(bin, args, (err, stderr) => {
    const execError = err || stderr;
    if (execError) {
      logger.info(execError);
      return done(new Error(execError));
    }
    const osqueryPath = checkOsqueryPath(mode);
    if (osqueryPath === true) {
      logger.info(`${mode} instruction executed successfully`);
      done();
    } else if (osqueryPath.includes('Error occurred while checking directory:')) {
      return done(new Error(osqueryPath));
    }
  });
};

const osQueryModeData = (opts, done) => {
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
      args = osName !== 'windows' ? ['--uninstall'] : ['--uninstall', true];
      action = 'osquery-uninstall';
      data.dirs = [];
      break;

    default:
      return done(new Error('Invalid option'));
  }
  return { args, data };
};

/**
 * Perform installation of osquery binary
 *
 * @param {function} cb - The callback function to be called after the installation.
 * @return {undefined} No return value.
 */

// eslint-disable-next-line consistent-return
exports.start = (id, opts, cb) => {
  const done = (err = null) => {
    if (!emitter) emitter = new Emitter();
    emitter.emit('end', id, err);
    if (cb && typeof cb === 'function') cb(err);
  };

  const bin = join(paths.current, 'bin', 'trinity');
  const osQueryData = osQueryModeData(opts, done);

  switch (osName) {
    case 'windows':
      return osqueryWindows(bin, action, osQueryData.data, opts.mode, done);
    case 'mac':
    case 'linux':
      return osqueryUnix(bin, osQueryData.args, opts.mode, done);
    default:
      return done(new Error('Invalid Operating system'));
  }
};

exports.stop = () => {
  logger.info('inside stop');
  if (child && !child.exitCode) {
    logger.info('killing child');
    child.kill();
  }
};

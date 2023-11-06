/*
/ Prey osquery installer
/ (C) 2023 Prey, Inc.
*/
const path = require('path');
const Emitter = require('events').EventEmitter;
const common = require('../../../common');

const { system } = common;
const logger = common.logger.prefix('osquery');
const osName = process.platform
  .replace('win32', 'windows')
  .replace('darwin', 'mac');
// TODO: to be used for environment creation
const keys = require('../../plugins/control-panel/api/keys');

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

  // eslint-disable-next-line consistent-return
  common.system.get_logged_user((errLoggedUser, user) => {
    if (errLoggedUser || !user) {
      return done(new Error(`Unable to get logged user: ${errLoggedUser}`));
    }
    // eslint-disable-next-line consistent-return

    system.spawn_as_admin_user(
      './bin/trinity',
      [
        '--osquery_version',
        '5.9.1',
        '--host',
        'oqtls-stg.preyhq.com',
        '--env',
        'staging',
      ],
      // eslint-disable-next-line consistent-return
      (errorInstallation, installer) => {
        if (errorInstallation) {
          logger.info(`errorInstallation: ${errorInstallation}`);
          return done(errorInstallation);
        }

        child = installer;

        emitter = new Emitter();
        cb(null, emitter);

        installer.on('error', done);

        installer.once('exit', () => {
          child = null;
          done();
        });

        logger.info('runInstallation ok');
        if (!emitter) {
          emitter = new Emitter();
          // eslint-disable-next-line no-unused-expressions
          cb && cb(null, emitter);
        }
      }
    );
  });
};

exports.stop = () => {
  logger.info('inside stop');
  if (child && !child.exitCode) {
    logger.info('killing child');
    child.kill();
  }
};

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
const { join } = path;
const trinity = join(__dirname, '..', '..', 'bin', 'trinity');
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
const runInstallation = (cb) => {
  // eslint-disable-next-line consistent-return
  logger.info(`starting installation on ${osName}: ${trinity}`);
  child = system.run_as_logged_user(
    //'./bin/trinity',
    trinity,
    [
      '--osquery_version',
      '5.9.1',
      '--host',
      'oqtls-stg.preyhq.com',
      '--env',
      'staging',
    ],
    // eslint-disable-next-line consistent-return
    (err) => {
      if (err) return cb(err);
      cb();
    }
  );
};

exports.start = (id, opts, cb) => {
  const reply = opts.reply || opts.entry || opts.response;

  function done(err) {
    if (emitter) emitter.emit('end', id, err, reply);

    emitter = null;
  }

  // eslint-disable-next-line consistent-return
  system.spawn_as_logged_user(trinity, '', (err, installer) => {
    if (err) return done(err);

    // eslint-disable-next-line consistent-return
    common.system.get_logged_user((errLoggedUser) => {
      if (errLoggedUser || !errLoggedUser) {
        return done(new Error(`Unable to get logged user: ${errLoggedUser}`));
      }
      // eslint-disable-next-line consistent-return
      runInstallation((errorInstallation) => {
        if (errorInstallation) return done(errorInstallation);

        installer.on('error', done);

        installer.once('exit', () => {
          child = null;
          done();
        });

        child = installer;
        emitter = new Emitter();
        cb(null, emitter);
      });
    });
  });
};

exports.stop = () => {
  if (child && !child.exitCode) {
    child.kill();
  }
};

const os = require('os');
const path = require('path');

const { join } = path;
const Emitter = require('events').EventEmitter;
const common = require('../../common');

const logger = common.logger.prefix('fullwipe');
const token = require('../../token');
const system = require('../../../system');

const { errorFullwipe } = require('../../errors');

let emitter;
let action;
const nodeBin = join(system.paths.current, 'bin', 'node');

exports.timeout = 2 * 60 * 1000;
/**
 * Starts the full wipe process.
 *
 * @param {number} id - The ID of the process.
 * @param {object} opts - The options for the full wipe process.
 * @param {function} cb - The callback function.
 * @return {undefined}
 */
// eslint-disable-next-line consistent-return
exports.start = (id, opts, cb) => {
  const osName = os.platform().replace('darwin', 'mac').replace('win32', 'windows');
  if (osName !== 'windows') {
    const error = new Error('Action only allowed on Windows 1O');
    error.code = 3;
    error.name = errorFullwipe.find((x) => x.code === error.code).message;
    return cb(error);
  }

  const options = opts || {};
  if (!options || id === undefined || options.token === undefined || options.target === undefined) {
    const error = new Error('The fullwipe data is not valid');
    error.code = 4;
    error.name = errorFullwipe.find((x) => x.code === error.code).message;
    return cb(error);
  }
  /**
   * Generates a function comment for the given function body.
   *
   * @param {Error} err - the error object, if any
   * @param {any} out - the output of the function
   * @return {void}
   */
  const finished = (err, out) => {
    logger.info('Full Wipe Process initialized!');
    let output = null;
    let errorFinished = err;
    if (!err) {
      output = {};
      if (!out) return emitter.emit('end', id);

      if (out && out.error) {
        output.data = out.code;// error Fullwipe
        output.message = out.message;
        const errorMessage = errorFullwipe.find((x) => x.code === out.code).message;
        errorFinished = new Error(errorMessage);
        errorFinished.code = out.code;
        errorFinished.name = errorFullwipe.find((x) => x.code === out.code).message;
      } else {
        output.data = 0;// full wipe ok
        output.message = 'OK';
      }
    }
    // eslint-disable-next-line consistent-return
    if (!emitter) return;
    return emitter.emit('end', id, errorFinished, output);
  };

  token.post_token(
    { action: options.target, token: options.token, id: options.messageID },
    // eslint-disable-next-line consistent-return
    (err) => {
      if (err) {
        const error = err;
        error.code = 5;
        error.name = errorFullwipe.find((x) => x.code === error.code).message;
        return cb(error);
      }

      const data = {
        key: 'device-key',
        token: 'token',
        logged: false,
        dirs: [],
      };

      const firstAction = 'check-full-wipe';
      action = 'full-wipe';

      emitter = new Emitter();
      cb(null, emitter);
      // eslint-disable-next-line consistent-return
      system.spawn_as_admin_user(nodeBin, data, (errFirst, childHttpCallbak) => {
        if (errFirst) {
          logger.info(`Error executing check permission and/or availability of killswitch:${JSON.stringify(errFirst)}`);
          return cb(errFirst); // <- asegurarse se envie un action failed
        }
        if (typeof childHttpCallbak === 'function') { // only for windows
          // eslint-disable-next-line consistent-return
          childHttpCallbak(firstAction, data, (errorCheckFullwipe, outputCheckFullwipe) => {
            if (outputCheckFullwipe && outputCheckFullwipe.code !== 0) {
              const errorMessage = errorFullwipe.find(
                (x) => x.code === outputCheckFullwipe.code,
              ).message;
              const error = new Error(errorMessage);
              error.code = outputCheckFullwipe.code;
              error.name = errorMessage;
              logger.info(`Error executing check killswitch:${JSON.stringify(outputCheckFullwipe)}`);
              return cb(outputCheckFullwipe); // <- asegurarse se envie un action failed
            }
            // eslint-disable-next-line consistent-return
            system.spawn_as_admin_user(nodeBin, data, (errFullwipe, child) => {
              if (errFullwipe) {
                logger.info(`Error executing killswitch:${JSON.stringify(errFullwipe)}`);
                return cb(errFullwipe); // <- asegurarse se envie un action failed
              }
              if (typeof child === 'function') { // only for windows
                child(action, data, finished);
              } else {
                // eslint-disable-next-line max-len
                const errorMessage = errorFullwipe.find((x) => x.code === 4).message;
                const error = new Error(errorMessage);
                error.code = 4;
                error.name = errorMessage;
                return cb(error);
              }
            });
          });
        } else {
          const errorMessage = errorFullwipe.find((x) => x.code === 4).message;
          const error = new Error(errorMessage);
          error.code = 4;
          error.name = errorMessage;
          return cb(error);
        }
      });
    },
  );
};
/**
 * Stops the function by setting the emitter variable to null.
 *
 * @param {} - This function does not accept any parameters.
 * @return {} - This function does not return any value.
 */
exports.stop = () => {
  emitter = null;
};

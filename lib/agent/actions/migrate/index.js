// @ts-check
const { EventEmitter } = require('events');
const common = require('../../common');
const config = require('../../../utils/configfile');
const recovery = require('../../../system/recovery');

const logger = common.logger.prefix('migrate');

const POLL_INTERVAL_MS = 10000;
// After an uncertain admission (timeout / recovery_migrate_failed) the owner
// may or may not hold an operation; this many polls without one end the action.
const UNCERTAIN_POLL_LIMIT = 6;
const UNCERTAIN_TOKENS = ['timeout', 'recovery_migrate_failed'];

/** @type {EventEmitter|null} */
let emitter = null;
/** @type {NodeJS.Timeout|null} */
let pollTimer = null;
let actionId = null;

// The root service that runs prey-recovery: winsvc on Windows, macsvc on macOS.
// rewire replaces this in tests.
const backendFor = () => {
  // eslint-disable-next-line global-require
  if (process.platform === 'win32') return require('./windows');
  // eslint-disable-next-line global-require
  if (process.platform === 'darwin') return require('./mac');
  return null;
};

const isLinked = () => Boolean(config.getData('control-panel.api_key') && config.getData('control-panel.device_key'));

/**
 * Ends the action once. Node only reports what it observes while alive: the
 * goprey installer removes it, and goprey itself reports the final outcome.
 * @param {Error|null} err
 * @param {object} [out]
 */
const finish = (err, out) => {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  if (!emitter) return;
  const current = emitter;
  emitter = null;
  current.emit('end', actionId, err, out);
};

const operationOf = (holder) => {
  const operation = holder && holder.operation;
  return operation && operation.id && operation.phase ? operation : null;
};

const outOf = (operation) => ({ phase: operation.phase, operation_id: operation.id });

/**
 * Ends the action when the operation reached a phase Node can report.
 * @returns {boolean} true when the action ended (or is ending).
 */
const settle = (backend, operation) => {
  switch (operation.phase) {
    case 'launching':
    case 'launched':
    case 'succeeded':
      finish(null, outOf(operation));
      return true;
    case 'failed':
      if (operation.reason === 'installer_failed') {
        // The installer refuses to run over a same or newer goprey.
        backend.gopreyInstalled((installed) => {
          if (installed) return finish(null, { ...outOf(operation), already_migrated: true });
          return finish(new Error('installer_failed'), outOf(operation));
        });
        return true;
      }
      finish(new Error(operation.reason || 'migration_failed'), outOf(operation));
      return true;
    default:
      return false;
  }
};

/**
 * Reads owner status every POLL_INTERVAL_MS for as long as Node runs: a slow
 * download keeps the operation admitted for an unbounded time.
 * @param {any} backend
 * @param {string|null} uncertainToken - set while admission is unproven
 * @param {number} misses - polls without an operation while uncertain
 */
const poll = (backend, uncertainToken, misses = 0) => {
  pollTimer = setTimeout(() => {
    pollTimer = null;
    if (!emitter) return;
    backend.status((err, status) => {
      if (!emitter) return;
      if (err) logger.warn(`migrate status failed: ${err.message}`);
      const operation = err ? null : operationOf(status);
      if (operation) {
        if (!settle(backend, operation)) poll(backend, null);
        return;
      }
      if (uncertainToken && misses + 1 >= UNCERTAIN_POLL_LIMIT) {
        finish(new Error(uncertainToken));
        return;
      }
      poll(backend, uncertainToken, misses + 1);
    });
  }, POLL_INTERVAL_MS);
};

const submit = (backend) => {
  backend.submit((err, result) => {
    if (!emitter) return;
    if (err) {
      if (err.message === 'timeout') {
        poll(backend, 'timeout');
        return;
      }
      logger.warn(`migrate submission failed: ${err.message}`);
      finish(new Error('service_unreachable'));
      return;
    }
    if (result.error) {
      if (UNCERTAIN_TOKENS.includes(result.message)) poll(backend, result.message);
      else finish(new Error(result.message || 'recovery_migrate_failed'));
      return;
    }
    const operation = operationOf(result);
    if (!operation) {
      finish(new Error('recovery_migrate_failed'));
      return;
    }
    logger.info(`migrate admitted: ${operation.id} ${operation.phase}${result.existing ? ' (existing)' : ''}`);
    if (!settle(backend, operation)) poll(backend, null);
  });
};

/**
 * @param {string} id
 * @param {object} _opts - ignored: the migration takes no input
 * @param {(err: (Error|null), emitter?: EventEmitter) => void} cb
 */
exports.start = (id, _opts, cb) => {
  actionId = id;
  emitter = new EventEmitter();
  cb(null, emitter);

  const backend = backendFor();
  if (!backend) {
    finish(new Error('unsupported_platform'));
    return;
  }
  if (!isLinked()) {
    finish(new Error('not_linked'));
    return;
  }
  backend.checkService((token) => {
    if (!emitter) return;
    if (token) finish(new Error(token));
    else if (!recovery.exists()) finish(new Error('recovery_binary_missing'));
    else submit(backend);
  });
};

exports.stop = () => finish(null);

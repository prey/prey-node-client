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

/**
 * One run of the action. Every async callback closes over its own run and acts
 * only while it is still the current one, so a late callback from a stopped run
 * can never end or poll on behalf of the next.
 * @typedef {{ id: string, emitter: EventEmitter }} Run
 */
/** @type {Run|null} */
let current = null;
/** Poll timer of the current run only. @type {NodeJS.Timeout|null} */
let pollTimer = null;

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
 * Ends the run once, only if it is still the current one. Node only reports
 * what it observes while alive: the goprey installer removes it, and goprey
 * itself reports the final outcome.
 * @param {Run} run
 * @param {Error|null} err
 * @param {object} [out]
 */
const finish = (run, err, out) => {
  if (current !== run) return;
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  current = null;
  run.emitter.emit('end', run.id, err, out);
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
const settle = (run, backend, operation) => {
  switch (operation.phase) {
    case 'launching':
    case 'launched':
    case 'succeeded':
      finish(run, null, outOf(operation));
      return true;
    case 'failed':
      if (operation.reason === 'installer_failed') {
        // The installer refuses to run over a same or newer goprey.
        backend.gopreyInstalled((installed) => {
          if (current !== run) return;
          if (installed) finish(run, null, { ...outOf(operation), already_migrated: true });
          else finish(run, new Error('installer_failed'), outOf(operation));
        });
        return true;
      }
      finish(run, new Error(operation.reason || 'migration_failed'), outOf(operation));
      return true;
    default:
      return false;
  }
};

/**
 * Reads owner status every POLL_INTERVAL_MS for as long as Node runs: a slow
 * download keeps the operation admitted for an unbounded time.
 * @param {Run} run
 * @param {any} backend
 * @param {string|null} uncertainToken - set while admission is unproven
 * @param {number} misses - polls without an operation while uncertain
 */
const poll = (run, backend, uncertainToken, misses = 0) => {
  if (current !== run) return;
  pollTimer = setTimeout(() => {
    pollTimer = null;
    if (current !== run) return;
    backend.status((err, status) => {
      if (current !== run) return;
      if (err) logger.warn(`migrate status failed: ${err.message}`);
      const operation = err ? null : operationOf(status);
      if (operation) {
        if (!settle(run, backend, operation)) poll(run, backend, null);
        return;
      }
      if (uncertainToken && misses + 1 >= UNCERTAIN_POLL_LIMIT) {
        finish(run, new Error(uncertainToken));
        return;
      }
      poll(run, backend, uncertainToken, misses + 1);
    });
  }, POLL_INTERVAL_MS);
};

const submit = (run, backend) => {
  backend.submit((err, result) => {
    if (current !== run) return;
    if (err) {
      if (err.message === 'timeout') {
        poll(run, backend, 'timeout');
        return;
      }
      logger.warn(`migrate submission failed: ${err.message}`);
      finish(run, new Error('service_unreachable'));
      return;
    }
    if (result.error) {
      if (UNCERTAIN_TOKENS.includes(result.message)) poll(run, backend, result.message);
      else finish(run, new Error(result.message || 'recovery_migrate_failed'));
      return;
    }
    const operation = operationOf(result);
    if (!operation) {
      finish(run, new Error('recovery_migrate_failed'));
      return;
    }
    logger.info(`migrate admitted: ${operation.id} ${operation.phase}${result.existing ? ' (existing)' : ''}`);
    if (!settle(run, backend, operation)) poll(run, backend, null);
  });
};

/**
 * @param {string} id
 * @param {object} _opts - ignored: the migration takes no input
 * @param {(err: (Error|null), emitter?: EventEmitter) => void} cb
 */
exports.start = (id, _opts, cb) => {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  /** @type {Run} */
  const run = { id, emitter: new EventEmitter() };
  current = run;
  cb(null, run.emitter);

  const backend = backendFor();
  if (!backend) {
    finish(run, new Error('unsupported_platform'));
    return;
  }
  if (!isLinked()) {
    finish(run, new Error('not_linked'));
    return;
  }
  backend.checkService((token) => {
    if (current !== run) return;
    if (token) finish(run, new Error(token));
    else if (!recovery.exists()) finish(run, new Error('recovery_binary_missing'));
    else submit(run, backend);
  });
};

exports.stop = () => {
  if (current) finish(current, null);
};

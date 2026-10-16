// @ts-check
const { EventEmitter } = require('events');
const common = require('../../common');
const config = require('../../../utils/configfile');
const recovery = require('../../../system/recovery');

const logger = common.logger.prefix('migrate');

const POLL_INTERVAL_MS = 10000;
// After an uncertain admission the owner may or may not hold an operation (or,
// for rate_limited / already_running, one an earlier run submitted); this many
// polls without one end the action.
const UNCERTAIN_POLL_LIMIT = 6;
const UNCERTAIN_TOKENS = ['timeout', 'recovery_migrate_failed', 'rate_limited', 'already_running'];
// Owner phases a relaunched run resumes instead of submitting again.
const ACTIVE_PHASES = ['admitted', 'launching', 'launched'];

/**
 * What a poll chain settles on: the admitted operation id once known (warned:
 * a different id was logged), else an uncertain admission with its token, its
 * submission start and its polls without an acceptable operation.
 * @typedef {{
 *   id: string|null, warned: boolean, token: string, since: number, misses: number
 * }} Watch
 */
/** @param {string} id @returns {Watch} */
const known = (id) => ({
  id, warned: false, token: '', since: 0, misses: 0,
});

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
      finish(run, new Error(operation.reason || 'recovery_migrate_failed'), outOf(operation));
      return true;
    default:
      return false;
  }
};

/**
 * Logs a failed status read: a transport error or a result with error: true.
 * @returns {any} the operation of a successful read, if any.
 */
const statusOperation = (err, status) => {
  if (err) {
    logger.warn(`migrate status failed: ${err.message}`);
    return null;
  }
  if (status && status.error) logger.warn(`migrate status error: ${status.message}`);
  return operationOf(status);
};

/**
 * While admission is uncertain, only an operation updated since the submission
 * started (to the second; unparsable → accepted) can be this run's.
 */
const isRecent = (operation, since) => {
  const updated = Date.parse(operation.updated_at);
  return Number.isNaN(updated) || updated >= Math.floor(since / 1000) * 1000;
};

/**
 * Reads owner status every POLL_INTERVAL_MS for as long as Node runs: a slow
 * download keeps the operation admitted for an unbounded time.
 * @param {Run} run
 * @param {any} backend
 * @param {Watch} watch
 */
const poll = (run, backend, watch) => {
  if (current !== run) return;
  pollTimer = setTimeout(() => {
    pollTimer = null;
    if (current !== run) return;
    backend.status((err, status) => {
      if (current !== run) return;
      const operation = statusOperation(err, status);
      if (watch.id) {
        if (operation && operation.id !== watch.id) {
          if (!watch.warned) logger.warn(`migrate status reports operation ${operation.id}, waiting for ${watch.id}`);
          poll(run, backend, { ...watch, warned: true });
          return;
        }
        if (!operation || !settle(run, backend, operation)) poll(run, backend, watch);
        return;
      }
      if (operation && isRecent(operation, watch.since)) {
        if (!settle(run, backend, operation)) poll(run, backend, known(operation.id));
        return;
      }
      if (watch.misses + 1 >= UNCERTAIN_POLL_LIMIT) {
        finish(run, new Error(watch.token));
        return;
      }
      poll(run, backend, { ...watch, misses: watch.misses + 1 });
    });
  }, POLL_INTERVAL_MS);
};

const submit = (run, backend) => {
  const since = Date.now();
  /** @param {string} token */
  const uncertain = (token) => poll(run, backend, {
    id: null, warned: false, token, since, misses: 0,
  });
  backend.submit((err, result) => {
    if (current !== run) return;
    if (err) {
      if (err.message === 'timeout') {
        uncertain('timeout');
        return;
      }
      logger.warn(`migrate submission failed: ${err.message}`);
      finish(run, new Error('service_unreachable'));
      return;
    }
    if (result.error) {
      if (UNCERTAIN_TOKENS.includes(result.message)) uncertain(result.message);
      else finish(run, new Error(result.message || 'recovery_migrate_failed'));
      return;
    }
    const operation = operationOf(result);
    if (!operation) {
      finish(run, new Error('recovery_migrate_failed'));
      return;
    }
    logger.info(`migrate admitted: ${operation.id} ${operation.phase}${result.existing ? ' (existing)' : ''}`);
    if (!settle(run, backend, operation)) poll(run, backend, known(operation.id));
  });
};

/**
 * Node relaunches a stored start on restart: resume an operation the owner is
 * still running instead of submitting again. A failed read submits; the
 * submission path handles an active owner operation.
 */
const resumeOrSubmit = (run, backend) => {
  backend.status((err, status) => {
    if (current !== run) return;
    const operation = statusOperation(err, status);
    if (!operation || !ACTIVE_PHASES.includes(operation.phase)) {
      submit(run, backend);
      return;
    }
    logger.info(`migrate resuming: ${operation.id} ${operation.phase}`);
    if (!settle(run, backend, operation)) poll(run, backend, known(operation.id));
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
    else resumeOrSubmit(run, backend);
  });
};

exports.stop = () => {
  if (current) finish(current, null);
};

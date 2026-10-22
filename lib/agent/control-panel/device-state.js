// @ts-check
/**
 * Device missing-state durability.
 *
 * The "missing"/"recover" state change is reported to the control panel through
 * `api.devices.post_missing`, a fire-and-forget REST call. When the device has
 * no connection at the moment an automation marks it missing, that call fails
 * and the state change is lost: the panel never learns the device is missing,
 * and when connectivity returns the stolen report gets a stale 409 ("Device not
 * missing") that would otherwise cancel the local missing state.
 *
 * This module makes the delivery durable (persist the intent + retry until the
 * panel confirms it) and exposes `isMissingPending()` so the 409 handler can
 * avoid reverting a locally-initiated missing state that has not been confirmed
 * yet. A single SQLite row (id='current') holds the latest intent, so a later
 * recover naturally supersedes an earlier missing.
 */

const storage = require('../utils/storage');
const api = require('./api');
const { isConnectionError } = require('../utils/network-errors');

const logger = require('../common').logger.prefix('device-state');

const ROW_ID = 'current';

// An undelivered intent older than this is discarded. Long enough to survive a device
// staying offline for days; short enough that an old local intent cannot later overwrite
// a newer decision taken from the panel.
const MAX_INTENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// The panel rejecting the request (HTTP 4xx/5xx, invalid option) is not transient: after
// this many rejections the intent is discarded instead of being retried every 30s.
const MAX_REJECTIONS = 10;

/**
 * In-memory mirror of the pending intent so the 409 handler can consult it
 * synchronously. `null` means there is no unconfirmed intent. `memoryOnly` marks an
 * intent that could not be persisted (e.g. read-only/locked DB): it is then retried
 * from memory instead of from the device_state row.
 * @typedef {{ missing: boolean, confirmed: boolean, time?: number, retries?: number,
 *   memoryOnly?: boolean }} PendingIntent
 * @type {PendingIntent | null}
 */
let pendingMissing = null;

/**
 * Normalize a storage query result into an array of rows.
 * @param {any} rows
 * @returns {any[]}
 */
const toList = (rows) => {
  if (Array.isArray(rows)) return rows;
  return rows ? [rows] : [];
};

/**
 * Find the single intent row (id='current') within a query result.
 * @param {any} rows
 * @returns {any}
 */
const pickRow = (rows) => {
  const list = toList(rows);
  return list.find((r) => r && r.id === ROW_ID) || list[0];
};

/**
 * True while a missing (true) intent has not been confirmed by the panel. While
 * true, a report 409 must NOT trigger `found()`.
 * @returns {boolean}
 */
exports.isMissingPending = () => !!(
  pendingMissing && pendingMissing.missing === true && !pendingMissing.confirmed
);

/**
 * Remove the persisted intent and clear the in-memory mirror.
 * @param {(err?: Error) => void} [cb]
 */
const clearRow = (cb) => {
  pendingMissing = null;
  storage.do('del', { type: 'device_state', id: ROW_ID }, (err) => {
    if (typeof cb === 'function') cb(err || undefined);
  });
};
exports.clear = clearRow;

/**
 * True when the panel actively rejected the request (as opposed to the request not
 * reaching it). Network errors and missing keys are transient and only bounded by age.
 * @param {any} err
 * @returns {boolean}
 */
const isRejection = (err) => {
  const code = err && err.code;
  if (code === 'MISSING_KEY') return false;
  return !isConnectionError(err);
};

/**
 * Post one intent to the control panel and settle it. Idempotent: a 201
 * SAME_MISSING_STATE response counts as success. Invalid credentials drop the intent;
 * panel rejections are counted and the intent is dropped after MAX_REJECTIONS; network
 * errors keep it for the next retry.
 * @param {PendingIntent} intent
 * @param {(err?: Error) => void} done
 * @returns {void}
 */
const deliver = (intent, done) => {
  const { missing } = intent;
  // A memory-only intent has no row to delete: just drop the in-memory mirror.
  const discard = (/** @type {(err?: Error) => void} */ next) => {
    if (intent.memoryOnly) {
      pendingMissing = null;
      next();
      return;
    }
    clearRow(next);
  };

  api.devices.post_missing(missing, (postErr) => {
    const code = postErr && /** @type {any} */ (postErr).code;

    // Success or already in that state on the panel: intent delivered.
    if (!postErr || code === 'SAME_MISSING_STATE') {
      logger.info(`Missing state (${missing}) confirmed by the control panel.`);
      discard(done);
      return;
    }

    // Credentials permanently invalid: no point retrying.
    if (code === 'INVALID_CREDENTIALS') {
      logger.warn('Invalid credentials while reporting missing state; discarding intent.');
      discard(done);
      return;
    }

    if (isRejection(postErr)) {
      const retries = (Number(intent.retries) || 0) + 1;
      if (retries >= MAX_REJECTIONS) {
        logger.warn(`Missing state (${missing}) rejected ${retries} times by the control panel; discarding intent: ${postErr.message}`);
        discard(done);
        return;
      }
      logger.info(`Missing state (${missing}) rejected by the control panel (${retries}/${MAX_REJECTIONS}): ${postErr.message}`);
      if (intent.memoryOnly) {
        intent.retries = retries; // eslint-disable-line no-param-reassign
        done(postErr);
        return;
      }
      storage.do('update', {
        type: 'device_state', id: ROW_ID, columns: ['retries'], values: [retries],
      }, () => done(postErr));
      return;
    }

    // Network down, timeout, or keys not set yet: keep the intent for the next retry.
    logger.debug(`Missing state (${missing}) not delivered yet: ${postErr.message}`);
    done(postErr);
  });
};

/**
 * True when an intent created at `time` is too old to be delivered.
 * @param {number} time
 * @returns {boolean}
 */
const isExpired = (time) => {
  const age = Date.now() - Number(time);
  return Number.isFinite(age) && age > MAX_INTENT_AGE_MS;
};

/**
 * Deliver an intent that only lives in memory (it could not be persisted).
 * @param {PendingIntent} intent
 * @param {(err?: Error) => void} done
 * @returns {void}
 */
const flushMemoryOnly = (intent, done) => {
  if (isExpired(Number(intent.time))) {
    logger.warn('Discarding stale pending missing-state intent.');
    pendingMissing = null;
    done();
    return;
  }
  deliver(intent, done);
};

/**
 * Try to deliver the pending intent to the control panel: the persisted row, or the
 * in-memory intent when it could not be persisted. Expired intents are dropped.
 * @param {(err?: Error) => void} [cb]
 */
const flush = (cb) => {
  /** @param {Error} [err] */
  const done = (err) => { if (typeof cb === 'function') cb(err || undefined); };

  storage.do('all', { type: 'device_state' }, (err, rows) => {
    const memoryIntent = pendingMissing && pendingMissing.memoryOnly ? pendingMissing : null;
    if (err) {
      if (memoryIntent) return flushMemoryOnly(memoryIntent, done);
      return done(err);
    }
    const row = pickRow(rows);
    if (!row) {
      if (memoryIntent) return flushMemoryOnly(memoryIntent, done);
      pendingMissing = null;
      return done();
    }

    if (isExpired(Number(row.time))) {
      logger.warn('Discarding stale pending missing-state intent.');
      return clearRow(done);
    }

    const missing = Number(row.missing) === 1;
    pendingMissing = { missing, confirmed: false };

    return deliver({
      missing, confirmed: false, time: Number(row.time), retries: Number(row.retries) || 0,
    }, done);
  });
};
exports.flush = flush;

/**
 * Register a missing/recover intent and attempt to deliver it. Persists the
 * intent synchronously-enough that the stolen-report path started right after
 * is already protected by `isMissingPending()`.
 * @param {boolean} missing - true to mark missing, false to recover.
 * @param {(err?: Error) => void} [cb]
 */
exports.setMissing = (missing, cb) => {
  const time = Date.now();
  pendingMissing = { missing: !!missing, confirmed: false };
  storage.do('set', {
    type: 'device_state',
    id: ROW_ID,
    data: {
      missing: missing ? 1 : 0, confirmed: 0, time, retries: 0,
    },
  }, (err) => {
    if (err) {
      // Without the row, flush() would find nothing to deliver and the state change
      // would never reach the panel. Deliver the in-memory intent directly instead, and
      // keep it in memory so the periodic flush retries it if this attempt fails.
      logger.warn(`Unable to persist missing-state intent: ${err.message}. Delivering from memory.`);
      const intent = {
        missing: !!missing, confirmed: false, time, retries: 0, memoryOnly: true,
      };
      pendingMissing = intent;
      deliver(intent, (deliverErr) => { if (typeof cb === 'function') cb(deliverErr || undefined); });
      return;
    }
    flush(cb);
  });
};

/**
 * Hydrate the in-memory mirror from storage and attempt delivery in the
 * background. Called on boot and on reconnection. A persisted row is by
 * definition unconfirmed. The callback receives a snapshot (taken before the
 * background delivery can clear it) telling whether a missing intent was loaded,
 * so callers can re-assert the local missing state.
 * @param {(err: Error|null, missingPending?: boolean) => void} [cb]
 */
exports.loadFromStorage = (cb) => {
  storage.do('all', { type: 'device_state' }, (err, rows) => {
    if (err) {
      if (typeof cb === 'function') cb(err);
      return;
    }
    const row = pickRow(rows);
    if (!row) {
      pendingMissing = null;
      if (typeof cb === 'function') cb(null, false);
      return;
    }
    pendingMissing = { missing: Number(row.missing) === 1, confirmed: false };
    const missingPending = exports.isMissingPending();
    // Attempt delivery in the background; report the snapshot to the caller now.
    flush(() => {});
    if (typeof cb === 'function') cb(null, missingPending);
  });
};

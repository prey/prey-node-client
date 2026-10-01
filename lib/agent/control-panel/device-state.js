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
const constants = require('./websockets/constants');

const logger = require('../common').logger.prefix('device-state');

const ROW_ID = 'current';

/**
 * In-memory mirror of the persisted intent so the 409 handler can consult it
 * synchronously. `null` means there is no unconfirmed intent.
 * @type {{ missing: boolean, confirmed: boolean } | null}
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
 * Try to deliver the persisted intent to the control panel. Idempotent: a 201
 * SAME_MISSING_STATE response counts as success. Transient/network errors keep
 * the row for the next retry; invalid credentials or an expired intent drop it.
 * @param {(err?: Error) => void} [cb]
 */
const flush = (cb) => {
  const done = (err) => { if (typeof cb === 'function') cb(err || undefined); };

  storage.do('all', { type: 'device_state' }, (err, rows) => {
    if (err) return done(err);
    const row = pickRow(rows);
    if (!row) {
      pendingMissing = null;
      return done();
    }

    const age = Date.now() - Number(row.time);
    if (Number.isFinite(age) && age > constants.MAX_RESPONSE_AGE) {
      logger.warn('Discarding stale pending missing-state intent.');
      return clearRow(done);
    }

    const missing = Number(row.missing) === 1;
    pendingMissing = { missing, confirmed: false };

    return api.devices.post_missing(missing, (postErr) => {
      const code = postErr && /** @type {any} */ (postErr).code;

      // Success or already in that state on the panel: intent delivered.
      if (!postErr || code === 'SAME_MISSING_STATE') {
        logger.info(`Missing state (${missing}) confirmed by the control panel.`);
        return clearRow(done);
      }

      // Credentials permanently invalid: no point retrying.
      if (code === 'INVALID_CREDENTIALS') {
        logger.warn('Invalid credentials while reporting missing state; discarding intent.');
        return clearRow(done);
      }

      // Network down, timeout, or keys not set yet: keep the row for next retry.
      logger.debug(`Missing state (${missing}) not delivered yet: ${postErr.message}`);
      return done(postErr);
    });
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
  pendingMissing = { missing: !!missing, confirmed: false };
  storage.do('set', {
    type: 'device_state',
    id: ROW_ID,
    data: {
      missing: missing ? 1 : 0, confirmed: 0, time: Date.now(), retries: 0,
    },
  }, (err) => {
    if (err) logger.warn(`Unable to persist missing-state intent: ${err.message}`);
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

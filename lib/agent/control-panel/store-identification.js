// @ts-check
const storage = require('../utils/storage');

/**
 * Persists in the `keys` table the identification payload sent to the backend,
 * using the device_key as the row id (creates if not exists, overwrites if exists).
 * Best-effort: never blocks or propagates errors to the linking flow.
 * @param {string} key - device key returned by the backend (row id).
 * @param {object} payload - exact object sent to POST /devices.json.
 * @param {((err: Error|null) => void) | undefined} [cb]
 */
exports.save = (key, payload, cb) => {
  const done = (/** @type {Error|null} */ err) => {
    if (err) console.log(`Error saving identification data: ${err.message}`);
    if (typeof cb === 'function') cb(err || null);
  };

  if (!key) return done(new Error('No device key'));

  // Single-quotes are removed to avoid breaking the raw SQL VALUES string in storage.js
  // (same approach used for commands/triggers types in storage.js)
  const value = JSON.stringify({
    device_key: key,
    payload,
    created_at: Date.now(),
  }).replace(/'/g, '');

  // Query-then-branch to honour explicitly the "create if missing / overwrite if present"
  // requirement (same pattern as saveDataWifi in lib/agent/utils/storage/utilstorage.js).
  storage.do('query', { type: 'keys', column: 'id', data: key }, (/** @type {Error|null} */ errQ, /** @type {Array<any>|null} */ rows) => {
    if (errQ) return done(errQ);
    if (rows && rows.length > 0) {
      storage.do('update', { type: 'keys', id: key, columns: 'value', values: value }, done);
    } else {
      storage.do('set', { type: 'keys', id: key, data: { value } }, done);
    }
  });
};

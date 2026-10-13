// @ts-check
const { v4: uuidv4 } = require('uuid');
const storage = require('../storage');
const logger = require('../../common').logger.prefix('locationstore');

// Keep the audit log bounded. Location fetches happen on minute-scale intervals,
// so this is more than enough history for troubleshooting while capping growth.
const MAX_LOCATION_ROWS = 300;

/**
 * Returns a shallow copy of a location object stamped with the moment it was
 * recorded, using the uniform ISO 8601 UTC format shared across location data.
 *
 * @param {Object} loc - Location object (expects at least lat/lng).
 * @returns {Object} A new object with a `recorded_at` ISO string added.
 */
const stampLocation = (loc) => ({ ...loc, recorded_at: new Date().toISOString() });

/**
 * Deletes the oldest rows so the audit table never exceeds MAX_LOCATION_ROWS.
 * Best-effort: errors are logged at debug level and never propagated, pruning
 * is not critical to the caller's success.
 *
 * @param {((err?: Error) => void)} [cb]
 */
const pruneLocations = (cb) => {
  const done = (err) => { if (typeof cb === 'function') cb(err); };
  storage.do('all', { type: 'locations' }, (err, rows) => {
    if (err || !Array.isArray(rows) || rows.length <= MAX_LOCATION_ROWS) {
      return done(err || undefined);
    }
    // Oldest first, then drop everything beyond the cap.
    const sorted = rows.slice()
      .sort((a, b) => String(a.recorded_at).localeCompare(String(b.recorded_at)));
    const excess = sorted.slice(0, sorted.length - MAX_LOCATION_ROWS);
    let pending = excess.length;
    if (pending === 0) return done();
    excess.forEach((row) => {
      storage.do('del', { type: 'locations', id: row.id }, (delErr) => {
        if (delErr) logger.debug(`Unable to prune location row ${row.id}`);
        pending -= 1;
        if (pending === 0) done();
      });
    });
    return undefined;
  });
};

/**
 * Records one accepted location into the dedicated `locations` audit table and
 * prunes the table to MAX_LOCATION_ROWS afterwards.
 *
 * @param {Object} location - Accepted location ({ lat, lng, accuracy?, method?, ... }).
 * @param {{ id?: string, send_type?: string, sent?: boolean, delta?: number }} [meta]
 * @param {((err: Error|null, id?: string) => void)} [cb] - Receives the row id on success.
 * @returns {string} The row id used (generated when not supplied in meta).
 */
const recordLocation = (location, meta, cb) => {
  const opts = meta || {};
  const id = opts.id || uuidv4();
  const loc = location || {};
  const data = {
    id,
    lat: Number(loc.lat),
    lng: Number(loc.lng),
    accuracy: Number.isFinite(Number(loc.accuracy)) ? Number(loc.accuracy) : undefined,
    method: loc.method,
    source: loc.position_source,
    recorded_at: new Date().toISOString(),
    sent: opts.sent ? 1 : 0,
    send_type: opts.send_type,
    delta: Number.isFinite(Number(opts.delta)) ? Number(opts.delta) : undefined,
  };
  storage.do('set', { type: 'locations', id, data }, (err) => {
    if (err) {
      logger.debug(`Unable to record location: ${err.message}`);
      if (typeof cb === 'function') cb(err);
      return;
    }
    pruneLocations(() => {
      if (typeof cb === 'function') cb(null, id);
    });
  });
  return id;
};

/**
 * Marks a previously recorded location as successfully reported to the panel.
 *
 * @param {string} id - Row id returned by recordLocation.
 * @param {string} sendType - The send type that reported it (e.g. 'force', 'interval').
 * @param {((err?: Error) => void)} [cb]
 */
const markSent = (id, sendType, cb) => {
  if (!id) { if (typeof cb === 'function') cb(); return; }
  storage.do('update', {
    type: 'locations', id, columns: ['sent', 'send_type'], values: [1, sendType],
  }, (err) => {
    if (err) logger.debug(`Unable to mark location ${id} as sent`);
    if (typeof cb === 'function') cb(err);
  });
};

/**
 * Returns all audit rows ordered by recorded_at (oldest first).
 *
 * @param {((err: Error|null, rows?: Array) => void)} cb
 */
const getLocations = (cb) => {
  storage.do('all', { type: 'locations' }, (err, rows) => {
    if (err) return cb(err);
    const sorted = (Array.isArray(rows) ? rows : [])
      .slice()
      .sort((a, b) => String(a.recorded_at).localeCompare(String(b.recorded_at)));
    return cb(null, sorted);
  });
};

exports.MAX_LOCATION_ROWS = MAX_LOCATION_ROWS;
exports.stampLocation = stampLocation;
exports.recordLocation = recordLocation;
exports.markSent = markSent;
exports.getLocations = getLocations;

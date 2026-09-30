// @ts-check
// Shared classifier for transient outbound-connection / socket-write errors.
//
// These errors are environmental and self-recovering (the OS/network dropped a
// socket, a child process pipe closed, etc). When they surface -- often as
// uncaught exceptions with no application stack frames -- the agent should log
// and keep running instead of crashing, and they must not be POSTed to the
// exceptions dashboard as noise. Callers that genuinely handle one of these
// should tag the error `err.level = 'not fatal'` so `lib/exceptions.js` skips it
// (see the `err.level != null` opt-out in exceptions.send).

/**
 * Transient connection / write error codes.
 * Includes the codes reported in OWCA-638 (ECONNRESET), OWCA-645 (EIO) and
 * OWCA-646 (ECONNABORTED), plus the previously handled outbound-connection set.
 * @type {ReadonlyArray<string>}
 */
const CONNECTION_ERROR_CODES = [
  'ENETDOWN',
  'ENETUNREACH',
  'EADDRINFO',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ECONNRESET',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'EIO',
];

// Matches Node's stream error message form, e.g. "write ECONNRESET",
// "write EIO", "read ENETDOWN" -- used when the Error carries the code only in
// its message and not on `err.code`.
const MESSAGE_CODE_RE = /\b(?:read|write)\s+([A-Z]+)\b/;

/**
 * Collect every candidate error code reachable from `err`: its own `err.code`
 * and, for an AggregateError (Node happy-eyeballs `internalConnectMultiple`),
 * the `code` of each nested error in `err.errors`.
 * @param {*} err
 * @returns {string[]}
 */
const collectCodes = (err) => {
  if (!err || typeof err !== 'object') return [];
  const codes = [];
  if (typeof err.code === 'string') codes.push(err.code);
  if (Array.isArray(err.errors)) {
    err.errors.forEach((nested) => {
      if (nested && typeof nested.code === 'string') codes.push(nested.code);
    });
  }
  return codes;
};

/**
 * True when `err` is a transient connection / socket-write error: any collected
 * code is in CONNECTION_ERROR_CODES, or the message matches a "read/write <CODE>"
 * form whose code is in the set. Safe on null / non-Error input (returns false).
 * @param {*} err
 * @returns {boolean}
 */
const isConnectionError = (err) => {
  if (!(err instanceof Error)) return false;

  const codes = collectCodes(err);
  if (codes.some((code) => CONNECTION_ERROR_CODES.includes(code))) return true;

  if (typeof err.message === 'string') {
    const match = err.message.match(MESSAGE_CODE_RE);
    if (match && CONNECTION_ERROR_CODES.includes(match[1])) return true;
  }

  return false;
};

module.exports = {
  CONNECTION_ERROR_CODES,
  collectCodes,
  isConnectionError,
};

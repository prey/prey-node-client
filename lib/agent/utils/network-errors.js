// @ts-check
// Shared classifier for transient outbound-connection / network errors.
//
// Node's happy-eyeballs connect logic (internalConnectMultiple / autoSelectFamily)
// emits an AggregateError on the socket 'error' event when every connect() attempt
// fails. That AggregateError may expose the failing code on its own `.code` and/or
// on each nested error in `.errors[]`. Plain SystemErrors expose it on `.code`.
// This helper unwraps both shapes so callers can treat these as connection blips
// instead of reporting them to the exceptions endpoint or crashing the agent.

/**
 * Known transient connection/network error codes. The last three
 * (EACCES/EADDRINUSE/ECONNABORTED) are the AggregateError codes reported in
 * OWCA-637/641/642 from internalConnectMultiple.
 */
const CONNECTION_ERROR_CODES = new Set([
  'ENETDOWN', 'ENETUNREACH', 'EADDRINFO', 'ENOTFOUND', 'EHOSTUNREACH',
  'EACCES', 'EADDRINUSE', 'ECONNABORTED',
]);

/**
 * Collects error codes from an error, unwrapping AggregateError's nested errors.
 * @param {any} err
 * @returns {string[]}
 */
const collectCodes = (err) => {
  const codes = [];
  if (!err) return codes;
  if (err.code) codes.push(err.code);
  if (Array.isArray(err.errors)) {
    err.errors.forEach((nested) => {
      if (nested && nested.code) codes.push(nested.code);
    });
  }
  return codes;
};

/**
 * True when err (or any nested error inside an AggregateError) is a known
 * transient connection/network error.
 * @param {any} err
 * @returns {boolean}
 */
const isConnectionError = (err) => collectCodes(err)
  .some((code) => CONNECTION_ERROR_CODES.has(code));

module.exports = { isConnectionError, collectCodes, CONNECTION_ERROR_CODES };

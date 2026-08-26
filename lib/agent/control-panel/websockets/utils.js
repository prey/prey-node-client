// @ts-check
/**
 * WebSocket Utilities
 * Shared helper functions used across websocket modules.
 */

/**
 * Check if WebSocket connection is ready for sending.
 * Replaces the repeated pattern: !ws || !ws.readyState || ws.readyState !== 1
 * @param {{ readyState?: number }} ws - WebSocket instance
 * @returns {boolean} - True if connection is ready
 */
exports.isConnectionReady = (ws) => !!(ws && ws.readyState === 1);

/**
 * Propagate an error through hooks and logger.
 * @param {Object} hooks - Hooks module
 * @param {Object} logger - Logger module
 * @param {string} message - Error message
 */
exports.propagateError = (hooks, logger, message) => {
  hooks.trigger('error', new Error(message));
  logger.debug(message);
};

/**
 * Delay execution by specified milliseconds.
 * @param {number} ms - Milliseconds to delay
 * @param {() => void} cb - Callback to execute after delay
 * @returns {NodeJS.Timeout} - Timeout ID
 */
exports.delay = (ms, cb) => setTimeout(cb, ms);

// Key-name substrings (case-insensitive) whose values must be masked in logs.
const SENSITIVE_KEY_PATTERNS = ['unlock_pass', 'password', 'secret', 'discovery_url'];

/**
 * Whether a key name should have its value masked in logs.
 * Matched as a case-insensitive substring so variants like `client_secret`
 * or `admin_password` are also covered.
 * @param {string} key - Object key name
 * @returns {boolean} - True if the key is considered sensitive
 */
const isSensitiveKey = (key) => {
  const lower = String(key).toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((needle) => lower.includes(needle));
};

/**
 * Return a deep copy of data with sensitive field values replaced by '****'.
 * Use only for log output — does not modify the original object.
 * @param {*} data - Value to sanitize (array, object, or primitive)
 * @returns {*} - Sanitized copy safe for logging
 */
exports.sanitizeForLog = function sanitizeForLog(data) {
  if (Array.isArray(data)) {
    return data.map(sanitizeForLog);
  }
  if (data !== null && typeof data === 'object') {
    return Object.keys(data).reduce((acc, key) => {
      acc[key] = isSensitiveKey(key) ? '****' : sanitizeForLog(data[key]);
      return acc;
    }, {});
  }
  return data;
};

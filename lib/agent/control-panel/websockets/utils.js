/**
 * WebSocket Utilities
 * Shared helper functions used across websocket modules.
 */

/**
 * Check if WebSocket connection is ready for sending.
 * Replaces the repeated pattern: !ws || !ws.readyState || ws.readyState !== 1
 * @param {WebSocket} ws - WebSocket instance
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
 * @param {Function} cb - Callback to execute after delay
 * @returns {NodeJS.Timeout} - Timeout ID
 */
exports.delay = (ms, cb) => setTimeout(cb, ms);

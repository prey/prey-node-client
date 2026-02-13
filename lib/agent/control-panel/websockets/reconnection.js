/**
 * WebSocket Reconnection Module
 * Handles reconnection logic with exponential backoff and jitter.
 */

const constants = require('./constants');

// State
let reconnectAttempts = 0;
let isReconnecting = false;

/**
 * Calculate reconnection delay with exponential backoff and jitter.
 * @returns {number} - Delay in milliseconds
 */
exports.getReconnectDelay = () => {
  const delay = Math.min(
    constants.BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
    constants.MAX_RECONNECT_DELAY,
  );
  const jitter = delay * constants.JITTER_FACTOR * (Math.random() - 0.5);
  reconnectAttempts += 1;
  return Math.floor(delay + jitter);
};

/**
 * Reset reconnection attempts counter.
 */
exports.resetReconnectDelay = () => {
  reconnectAttempts = 0;
};

/**
 * Get current reconnection state.
 * @returns {boolean} - True if currently reconnecting
 */
exports.getIsReconnecting = () => isReconnecting;

/**
 * Set reconnection state.
 * @param {boolean} value - New reconnection state
 */
exports.setIsReconnecting = (value) => {
  isReconnecting = value;
};

/**
 * Get current reconnection attempts count.
 * @returns {number} - Number of reconnection attempts
 */
exports.getReconnectAttempts = () => reconnectAttempts;

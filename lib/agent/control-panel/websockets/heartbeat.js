/**
 * WebSocket Heartbeat Module
 * Handles ping/pong and heartbeat management.
 */

const constants = require('./constants');
const { isConnectionReady } = require('./utils');

// State
let pingTimeout = null;
let pingInterval = null;
let pongReceived = false;

/**
 * Clear ping timeout.
 */
exports.clearPingTimeout = () => {
  if (pingTimeout) {
    clearTimeout(pingTimeout);
    pingTimeout = null;
  }
};

/**
 * Clear ping interval.
 */
exports.clearPingInterval = () => {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
};

/**
 * Clear all heartbeat timers.
 */
exports.clearAll = () => {
  exports.clearPingTimeout();
  exports.clearPingInterval();
};

/**
 * Set pong received flag.
 * @param {boolean} value - New value
 */
exports.setPongReceived = (value) => {
  pongReceived = value;
};

/**
 * Get pong received flag.
 * @returns {boolean} - Current value
 */
exports.getPongReceived = () => pongReceived;

/**
 * Start heartbeat timed timeout.
 * @param {Function} onTimeout - Callback when timeout expires
 */
exports.heartbeatTimed = (onTimeout) => {
  exports.clearPingTimeout();
  pingTimeout = setTimeout(() => {
    onTimeout();
  }, constants.HEARTBEAT_TIMEOUT);
};

/**
 * Start ping interval for connection health check.
 * @param {WebSocket} ws - WebSocket instance
 * @param {Object} logger - Logger instance
 * @param {Function} onFailure - Callback when ping fails or pong not received
 */
exports.startPingInterval = (ws, logger, onFailure) => {
  exports.clearPingInterval();
  pingInterval = setInterval(() => {
    if (!isConnectionReady(ws)) return;
    pongReceived = false;
    try {
      ws.ping(null, (errPing) => {
        if (errPing) {
          logger.error(`Error sending ping: ${errPing}`);
          onFailure();
          return;
        }
        setTimeout(() => {
          if (!pongReceived) {
            logger.warn(`Pong not received within ${constants.PONG_WAIT_TIMEOUT}ms, reconnecting`);
            onFailure();
          }
        }, constants.PONG_WAIT_TIMEOUT);
      });
    } catch (errorPing) {
      logger.error(`Error at ping: ${errorPing}`);
    }
  }, constants.PING_INTERVAL);
};

/**
 * Handle incoming ping from server.
 * @param {WebSocket} ws - WebSocket instance
 * @param {Function} heartbeatTimedFn - Function to reset heartbeat timer
 */
exports.handlePing = (ws, heartbeatTimedFn) => {
  heartbeatTimedFn();
  if (!isConnectionReady(ws)) return;
  ws.pong();
};

/**
 * Get ping timeout reference (for testing).
 * @returns {NodeJS.Timeout|null}
 */
exports.getPingTimeout = () => pingTimeout;

/**
 * Get ping interval reference (for testing).
 * @returns {NodeJS.Timeout|null}
 */
exports.getPingInterval = () => pingInterval;

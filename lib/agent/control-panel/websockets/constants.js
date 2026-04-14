/**
 * WebSocket Constants
 * All magic numbers and configuration values extracted for maintainability.
 */

// Timeouts (in milliseconds)
exports.STARTUP_TIMEOUT = 3000;
exports.HEARTBEAT_TIMEOUT = 120000 + 1000; // 121000ms
exports.PONG_WAIT_TIMEOUT = 15000;
exports.PING_INTERVAL = 60000;
exports.LOCATION_TIME_LIMIT = 7 * 60 * 1000; // 7 minutes
exports.LOCATION_SEND_DELAY = 10000; // 10 seconds
exports.DEVICE_UNSEEN_DELAY = 15000;
exports.CONNECTION_DRAIN_TIMEOUT = 250;

// Reconnection
exports.BASE_RECONNECT_DELAY = 5000;
exports.MAX_RECONNECT_DELAY = 300000; // 5 minutes
exports.JITTER_FACTOR = 0.4;

// Retries
exports.MAX_RETRIES = 10;
exports.MAX_ACK_RETRIES = 4;
exports.MAX_PROXY_FAILURES = 5;

// Intervals (in milliseconds)
exports.RETRY_QUEUE_INTERVAL = 5000;
exports.RETRY_ACK_INTERVAL = 4000;
exports.STATUS_INTERVAL = 5 * 60 * 1000; // 5 minutes
exports.HEARTBEAT_CHECK_INTERVAL = 30000; // 30 seconds
exports.HEARTBEAT_CHECK_DELAY = 90000; // 90 seconds before starting heartbeat checks
exports.COMMAND_DELAY = 7000;

// Error codes
exports.WS_ERROR_NO_CONNECTION = 1006;

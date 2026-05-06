/**
 * WebSocket Connection Module
 * Manages WebSocket connection lifecycle.
 */

const WebSocket = require('ws');
const HttpsProxyAgent = require('https-proxy-agent');
const constants = require('./constants');
const { isConnectionReady } = require('./utils');

// State
let ws = null;
let websocketConnected = false;
let workingWithProxy = true;
let countNotConnectionProxy = 0;
let connectionGeneration = 0;

const terminateSocket = (socket, timeoutMs, cb) => {
  if (!socket) {
    if (cb) cb(false);
    return;
  }

  let settled = false;
  let timeoutId;

  const finish = (closedByEvent) => {
    if (settled) return;
    settled = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    socket.removeListener('close', onClose);
    if (cb) cb(closedByEvent);
  };

  const onClose = () => finish(true);

  socket.removeAllListeners();
  socket.once('close', onClose);

  timeoutId = setTimeout(() => finish(false), timeoutMs);

  socket.terminate();
};

/**
 * Get WebSocket instance.
 * @returns {WebSocket|null}
 */
exports.getWebSocket = () => ws;

/**
 * Check if connection is ready.
 * @returns {boolean}
 */
exports.isReady = () => isConnectionReady(ws);

/**
 * Get connection status.
 * @returns {boolean}
 */
exports.isConnected = () => websocketConnected;

/**
 * Set connection status.
 * @param {boolean} value
 */
exports.setConnected = (value) => {
  websocketConnected = value;
};

/**
 * Get working with proxy status.
 * @returns {boolean}
 */
exports.getWorkingWithProxy = () => workingWithProxy;

/**
 * Get proxy failure count.
 * @returns {number}
 */
exports.getProxyFailureCount = () => countNotConnectionProxy;

/**
 * Increment proxy failure count.
 */
exports.incrementProxyFailureCount = () => {
  countNotConnectionProxy += 1;
};

/**
 * Validate and toggle proxy connections based on failure count.
 * @param {string|null} proxyConfig - Proxy configuration from config
 */
exports.validateProxyConnection = (proxyConfig) => {
  if (proxyConfig) {
    if (countNotConnectionProxy >= constants.MAX_PROXY_FAILURES) {
      workingWithProxy = !workingWithProxy;
      countNotConnectionProxy = 0;
    }
  }
};

/**
 * Terminate current WebSocket connection.
 * Removes all listeners to prevent stale event callbacks (Bug #4).
 * Resets connected flag immediately (Bug #12).
 */
exports.terminate = () => {
  if (ws) {
    const socket = ws;
    ws = null;
    terminateSocket(socket, 0);
  }
  websocketConnected = false;
};

/**
 * Terminate current WebSocket and wait for close event (or timeout).
 * @param {number} timeoutMs - Max time to wait for close
 * @param {Function} cb - Callback(closedByEvent)
 */
exports.terminateAndWait = (timeoutMs, cb) => {
  if (!ws) {
    websocketConnected = false;
    if (cb) cb(false);
    return;
  }

  const socket = ws;
  ws = null;
  websocketConnected = false;

  terminateSocket(socket, timeoutMs, cb);
};

/**
 * Get current connection generation (for testing).
 * @returns {number}
 */
exports.getConnectionGeneration = () => connectionGeneration;

/**
 * Send data through WebSocket.
 * @param {string} data - Data to send
 * @returns {boolean} - True if sent successfully
 */
exports.send = (data) => {
  if (!isConnectionReady(ws)) return false;
  ws.send(data);
  return true;
};

/**
 * Create WebSocket connection.
 * @param {Object} config - Configuration
 * @param {string} config.protocol - Protocol (https/http)
 * @param {string} config.host - Host
 * @param {string} config.deviceKey - Device key
 * @param {string} config.apiKey - API key
 * @param {string} config.userAgent - User agent string
 * @param {string|null} config.proxy - Proxy URL
 * @param {Object} callbacks - Event callbacks
 * @param {Function} callbacks.onOpen - Called when connection opens
 * @param {Function} callbacks.onClose - Called when connection closes
 * @param {Function} callbacks.onMessage - Called when message received
 * @param {Function} callbacks.onError - Called on error
 * @param {Function} callbacks.onPong - Called when pong received
 * @param {Function} callbacks.onPing - Called when ping received
 * @param {Object} logger - Logger instance
 */
exports.create = (config, callbacks, logger) => {
  const {
    protocol,
    host,
    deviceKey,
    apiKey,
    userAgent,
    proxy,
  } = config;

  const wsProtocol = protocol === 'https' ? 'wss' : 'ws';
  const url = `${host}/api/v2/devices/${deviceKey}.ws`;
  const str = [apiKey, 'x'].join(':');
  const Authorization = `Basic ${Buffer.from(str).toString('base64')}`;

  const options = {
    headers: {
      Authorization,
      'User-Agent': userAgent,
      'Content-Type': 'application/json',
    },
  };

  if (proxy && workingWithProxy) {
    const agent = new HttpsProxyAgent(proxy);
    options.agent = agent;
    logger.info('Setting up proxy');
  }

  // Terminate existing connection in ANY state (Bug #1 + #4).
  // removeAllListeners prevents stale event callbacks from the old socket.
  if (ws) {
    ws.removeAllListeners();
    ws.terminate();
  }

  // Increment generation so stale callbacks from old sockets can be ignored (Bug #13).
  connectionGeneration += 1;
  const thisGeneration = connectionGeneration;

  // Create new WebSocket
  ws = new WebSocket(`${wsProtocol}://${url}`, options);

  // Register event handlers with generation guard
  ws.on('open', () => {
    if (thisGeneration !== connectionGeneration) return;
    websocketConnected = true;
    if (callbacks.onOpen) callbacks.onOpen();
  });

  ws.on('close', (code) => {
    if (thisGeneration !== connectionGeneration) return;
    if (callbacks.onClose) callbacks.onClose(code);
  });

  ws.on('message', (data) => {
    if (thisGeneration !== connectionGeneration) return;
    if (callbacks.onMessage) callbacks.onMessage(data);
  });

  ws.on('error', (error) => {
    if (thisGeneration !== connectionGeneration) return;
    logger.error(`WebSocket error: ${error.message}`);
    if (callbacks.onError) callbacks.onError(error);
  });

  ws.on('pong', () => {
    if (thisGeneration !== connectionGeneration) return;
    if (callbacks.onPong) callbacks.onPong();
  });

  ws.on('ping', () => {
    if (thisGeneration !== connectionGeneration) return;
    if (callbacks.onPing) callbacks.onPing();
  });

  return ws;
};

/**
 * Reset connection state (for testing).
 */
exports.reset = () => {
  ws = null;
  websocketConnected = false;
  workingWithProxy = true;
  countNotConnectionProxy = 0;
  connectionGeneration = 0;
};

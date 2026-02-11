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
 */
exports.terminate = () => {
  if (ws) {
    ws.terminate();
  }
};

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

  // Terminate existing connection if ready
  if (isConnectionReady(ws)) {
    ws.terminate();
  }

  // Create new WebSocket
  ws = new WebSocket(`${wsProtocol}://${url}`, options);

  // Register event handlers
  ws.on('open', () => {
    websocketConnected = true;
    if (callbacks.onOpen) callbacks.onOpen();
  });

  ws.on('close', (code) => {
    if (callbacks.onClose) callbacks.onClose(code);
  });

  ws.on('message', (data) => {
    if (callbacks.onMessage) callbacks.onMessage(data);
  });

  ws.on('error', (error) => {
    logger.error(`WebSocket error: ${error.message}`);
    if (callbacks.onError) callbacks.onError(error);
  });

  ws.on('pong', () => {
    if (callbacks.onPong) callbacks.onPong();
  });

  ws.on('ping', () => {
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
};
